// Backup del hub (F3 PR6, análisis §3.8). En modo distribuido la copia completa de los datos del negocio es
// la del hub: cada caja se restaura volviendo a bajar su base, pero el hub necesita su propio respaldo. La copia
// usa la API de backup de SQLite (sirve con la base en uso y con WAL), va a `<carpeta>/backups` y se guardan las
// últimas N. Restaurar se hace desde la consola con el hub detenido y deja antes una copia de la base que pisa.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const RETENER_POR_DEFECTO = 14;
/** Cada cuánto el hub en marcha hace una copia nueva. */
export const RESPALDO_CADA_MS = 24 * 3_600_000;
const PATRON = /^hub-(\d{8})-(\d{6})(?:-(\d+))?\.db$/;

export interface RespaldoHub { readonly archivo: string; readonly fecha: Date; readonly bytes: number }

const carpetaRespaldos = (carpeta: string) => path.join(carpeta, 'backups');

function sello(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Número de copia dentro del mismo segundo: 1 sin sufijo, 2 para `-2`… */
function sufijo(archivo: string): number {
  return Number(PATRON.exec(path.basename(archivo))?.[3] ?? 1);
}

function fechaDe(nombre: string): Date | null {
  const m = PATRON.exec(nombre);
  if (!m) return null;
  const [d, h] = [m[1]!, m[2]!];
  return new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +h.slice(0, 2), +h.slice(2, 4), +h.slice(4, 6));
}

/** Copias del hub, de la más nueva a la más vieja (solo las periódicas o manuales, no la previa a restaurar). */
export function listarRespaldos(carpeta: string): RespaldoHub[] {
  const dir = carpetaRespaldos(carpeta);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((f) => ({ f, fecha: fechaDe(f) }))
    .filter((x): x is { f: string; fecha: Date } => x.fecha !== null)
    .map((x) => ({ archivo: path.join(dir, x.f), fecha: x.fecha, bytes: fs.statSync(path.join(dir, x.f)).size }))
    // Mismo segundo: `-2`, `-3`… son posteriores a la copia sin sufijo.
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || sufijo(b.archivo) - sufijo(a.archivo));
}

/**
 * Copia la base abierta a `destino` con la API de backup: primero a un temporal, la deja como un solo archivo
 * (sin WAL: la copia hereda el modo de la base del hub) y la renombra a un nombre libre (`-2`, `-3`… si dos
 * copias caen en el mismo segundo, por ejemplo la automática y la de la consola). Devuelve el nombre final.
 */
async function copiarBase(sqlite: Database.Database, destino: string): Promise<string> {
  const tmp = `${destino}.${process.pid}.${Date.now()}.tmp`;
  try {
    await sqlite.backup(tmp);
    const copia = new Database(tmp);
    try { copia.pragma('journal_mode = DELETE'); } finally { copia.close(); }
    let final = destino;
    for (let n = 2; fs.existsSync(final); n++) final = destino.replace(/\.db$/, `-${n}.db`);
    fs.renameSync(tmp, final);
    return final;
  } finally {
    for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) fs.rmSync(f, { force: true });
  }
}

/** ¿Toca una copia nueva? Sin copias, o la última es de hace más de un día. */
export function respaldoVencido(carpeta: string, ahora: Date = new Date()): boolean {
  const [ultimo] = listarRespaldos(carpeta);
  return !ultimo || ahora.getTime() - ultimo.fecha.getTime() >= RESPALDO_CADA_MS;
}

/** Copia la base del hub (abierta) y borra las más viejas que las últimas `retener`. Devuelve la copia. */
export async function respaldarHub(
  sqlite: Database.Database,
  carpeta: string,
  o: { retener?: number; ahora?: Date } = {},
): Promise<string> {
  const dir = carpetaRespaldos(carpeta);
  fs.mkdirSync(dir, { recursive: true });
  const destino = await copiarBase(sqlite, path.join(dir, `hub-${sello(o.ahora ?? new Date())}.db`));
  const retener = Math.max(1, o.retener ?? RETENER_POR_DEFECTO);
  for (const viejo of listarRespaldos(carpeta).slice(retener)) fs.rmSync(viejo.archivo, { force: true });
  return destino;
}

/** ¿Hay algo escuchando en ese puerto local? (el hub en marcha, como servicio o desde la consola) */
function puertoOcupado(puerto: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: puerto });
    const fin = (r: boolean) => { s.destroy(); resolve(r); };
    s.setTimeout(800, () => fin(false));
    s.once('connect', () => fin(true));
    s.once('error', () => fin(false));
  });
}

function esBaseDelHub(archivo: string): boolean {
  try {
    const db = new Database(archivo, { readonly: true, fileMustExist: true });
    try {
      const t = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('__drizzle_migrations_hub', 'hub_cambio')").get() as { n: number };
      return t.n === 2;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/**
 * Restaura una copia sobre la base del hub. Exige el hub detenido (nada escuchando en su puerto) y una base del
 * hub válida; antes de pisar, guarda la base actual en `backups/hub-antes-de-restaurar-<fecha>.db`.
 * Devuelve la ruta de esa copia previa (null si no había base).
 */
export async function restaurarRespaldo(carpeta: string, archivo: string, o: { puerto: number; ahora?: Date }): Promise<string | null> {
  if (!fs.existsSync(archivo)) throw new Error('RESPALDO_INEXISTENTE');
  if (!esBaseDelHub(archivo)) throw new Error('RESPALDO_INVALIDO');
  if (await puertoOcupado(o.puerto)) throw new Error('HUB_EN_MARCHA');
  const base = path.join(carpeta, 'hub.db');
  let previa: string | null = null;
  if (fs.existsSync(base)) {
    fs.mkdirSync(carpetaRespaldos(carpeta), { recursive: true });
    // Con la API de backup: incluye lo que esté en el WAL.
    const actual = new Database(base);
    try {
      previa = await copiarBase(actual, path.join(carpetaRespaldos(carpeta), `hub-antes-de-restaurar-${sello(o.ahora ?? new Date())}.db`));
    } finally {
      actual.close();
    }
  }
  for (const extra of ['-wal', '-shm']) fs.rmSync(`${base}${extra}`, { force: true });
  fs.copyFileSync(archivo, base);
  return previa;
}
