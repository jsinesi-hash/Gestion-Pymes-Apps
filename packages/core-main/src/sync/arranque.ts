// Arranque de una terminal en modo distribuido (ADR-150 §2 y §10). La primera terminal sube su base al
// hub como semilla; las siguientes bajan el snapshot y reemplazan con él sus tablas que sincronizan.
// También: leer el certificado de un hub antes de confiar en él (el usuario confirma la huella).
import tls from 'node:tls';
import type * as BetterSqlite3 from 'better-sqlite3';
import { isIP } from 'node:net';
import { aplicandoCambiosRecibidos, desinstalarTriggersSync, type RegistroSync } from '@core/db';
import { huellaDe, PUERTO_POR_DEFECTO, RUTAS, type CambioEntrante, type Snapshot } from '@core/hub';
import { recalcularSaldoCuentaCorriente } from '../ctacte-proyeccion';
import { CLAVE_CURSOR, cuerpo, tablasDelCliente, type CambioAplicado, type DbSync } from './cliente';
import type { TransporteHub } from './transporte';

const q = (n: string) => `"${n}"`;

/** La semilla y el snapshot son los pedidos más largos: una base entera. */
const TIMEOUT_ARRANQUE_MS = 5 * 60 * 1000;
const TAM_PARTE_SEMILLA = 2000;

/** `host`, `host:puerto` o una URL: devuelve `https://host:puerto` (puerto 7443 si falta). */
export function normalizarUrlHub(texto: string): string {
  const crudo = texto.trim();
  if (!crudo) throw new Error('URL_HUB_INVALIDA');
  let u: URL;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
  } catch {
    throw new Error('URL_HUB_INVALIDA');
  }
  if (u.protocol !== 'https:' || !u.hostname || (u.pathname !== '/' && u.pathname !== '')) throw new Error('URL_HUB_INVALIDA');
  return `https://${u.hostname}:${u.port || PUERTO_POR_DEFECTO}`;
}

/**
 * Lee el certificado que presenta el hub, sin confiar todavía en él (ADR-158 §3). La terminal muestra
 * la huella y el usuario la compara con la que muestra el hub antes de emparejar.
 */
export function sondearHub(url: string, timeoutMs = 10_000): Promise<{ url: string; certPem: string; huella: string }> {
  const base = normalizarUrlHub(url);
  const { hostname, port } = new URL(base);
  const host = hostname.replace(/^\[|\]$/g, '');
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host, port: Number(port), rejectUnauthorized: false, timeout: timeoutMs,
      ...(isIP(host) ? {} : { servername: host }),
    }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.end();
      if (!cert?.raw) { reject(new Error('HUB_SIN_CERTIFICADO')); return; }
      const b64 = cert.raw.toString('base64').match(/.{1,64}/g)!.join('\n');
      const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
      resolve({ url: base, certPem, huella: huellaDe(certPem) });
    });
    socket.on('timeout', () => socket.destroy(new Error('TIEMPO_AGOTADO')));
    socket.on('error', (e) => reject(e.message === 'TIEMPO_AGOTADO' ? e : new Error(`HUB_INALCANZABLE: ${e.message}`)));
  });
}

/** Todas las filas que sincronizan, con las columnas que viajan (sin las proyectadas). */
export function filasDeSemilla(db: DbSync, schema: Record<string, unknown>, registro: RegistroSync): CambioEntrante[] {
  const out: CambioEntrante[] = [];
  for (const t of tablasDelCliente(schema, registro).values()) {
    const cols = [...t.datos].map(q).join(', ');
    for (const fila of db.$client.prepare(`SELECT ${cols} FROM ${q(t.nombre)} ORDER BY "id"`).all() as Record<string, unknown>[]) {
      out.push({ tabla: t.nombre, fila });
    }
  }
  return out;
}

/**
 * Sube la semilla en partes; el hub las aplica juntas con la última (las FK se verifican sobre el
 * total). Devuelve el cursor del hub después de la semilla. Solo funciona con el hub vacío.
 */
export async function subirSemilla(transporte: TransporteHub, cambios: readonly CambioEntrante[], tamParte = TAM_PARTE_SEMILLA): Promise<number> {
  const partes = Math.max(1, Math.ceil(cambios.length / tamParte));
  let r: Record<string, unknown> = {};
  for (let i = 0; i < partes; i++) {
    const parte = cambios.slice(i * tamParte, (i + 1) * tamParte);
    r = cuerpo(await transporte.pedir('POST', RUTAS.semilla, { cambios: parte, inicio: i === 0, fin: i === partes - 1 }, { timeoutMs: TIMEOUT_ARRANQUE_MS }));
  }
  const rechazados = Array.isArray(r['rechazados']) ? r['rechazados'].length : 0;
  if (rechazados > 0) throw new Error(`SEMILLA_RECHAZADA: ${rechazados} filas`);
  if (typeof r['cursor'] !== 'number') throw new Error('HUB_RESPUESTA_INVALIDA: semilla');
  return r['cursor'];
}

export async function bajarSnapshot(transporte: TransporteHub): Promise<Snapshot> {
  const r = cuerpo(await transporte.pedir('GET', RUTAS.snapshot, undefined, { timeoutMs: TIMEOUT_ARRANQUE_MS }));
  if (typeof r['cursor'] !== 'number' || !Array.isArray(r['tablas'])) throw new Error('HUB_RESPUESTA_INVALIDA: snapshot');
  return { cursor: r['cursor'], tablas: r['tablas'] as Snapshot['tablas'] };
}

export function escribirCursor(db: DbSync, cursor: number): void {
  db.$client.prepare(
    'INSERT INTO "parametros_sistema" ("clave", "valor", "tipo", "descripcion", "actualizado_en") VALUES (?, ?, \'number\', ?, ?) ' +
    'ON CONFLICT ("clave") DO UPDATE SET "valor" = excluded."valor", "actualizado_en" = excluded."actualizado_en"',
  ).run(CLAVE_CURSOR, String(cursor), 'Último cambio del hub aplicado en esta terminal (ADR-150 §4).', Math.floor(Date.now() / 1000));
}

export interface OpcionesSnapshot {
  readonly schema: Record<string, unknown>;
  readonly registro: RegistroSync;
  /** Proyecciones de la app (stock y costo): recibe todas las filas cargadas. */
  readonly alAplicar?: (aplicados: readonly CambioAplicado[]) => void;
}

/**
 * Reemplaza las tablas que sincronizan por las del snapshot (ADR-150 §10): una terminal nueva o una
 * restauración en modo distribuido. Las tablas locales (geo, parámetros de la terminal) se conservan;
 * una fila local que apuntaba a una fila reemplazada (un aviso, un código de recuperación) se descarta.
 * Recalcula las proyecciones, deja la cola vacía y el cursor en el del snapshot. Quita los triggers de
 * captura: quien llama los vuelve a instalar.
 */
export function cargarSnapshot(db: DbSync, snapshot: Snapshot, o: OpcionesSnapshot): { filas: number } {
  const sqlite = db.$client;
  const tablas = tablasDelCliente(o.schema, o.registro);
  desinstalarTriggersSync(sqlite, o.schema, o.registro);
  return aplicandoCambiosRecibidos(sqlite, () => {
    sqlite.pragma('defer_foreign_keys = ON');
    for (const t of tablas.values()) sqlite.prepare(`DELETE FROM ${q(t.nombre)}`).run();
    const aplicados: CambioAplicado[] = [];
    const sentencias = new Map<string, BetterSqlite3.Statement>();
    for (const { tabla, filas } of snapshot.tablas) {
      const t = tablas.get(tabla);
      if (!t) continue; // tabla que esta versión no conoce (hub una versión adelante)
      for (const fila of filas) {
        const cols = Object.keys(fila).filter((k) => t.datos.has(k) && k !== 'sync_state').sort();
        const extra = t.proyectadasSinDefault.filter((k) => !cols.includes(k));
        const todas = [...cols, ...extra, 'sync_state'];
        const sql = `INSERT INTO ${q(t.nombre)} (${todas.map(q).join(', ')}) VALUES (${todas.map((k) => (k === 'sync_state' ? '\'synced\'' : '?')).join(', ')})`;
        let s = sentencias.get(sql);
        if (!s) { s = sqlite.prepare(sql); sentencias.set(sql, s); }
        s.run(...cols.map((k) => fila[k] as unknown), ...extra.map(() => 0));
        aplicados.push({ tabla: t.nombre, fila, nueva: true });
      }
    }
    if (tablas.has('cuenta_corriente_cliente')) {
      for (const { id } of sqlite.prepare('SELECT "id" FROM "cuenta_corriente_cliente"').all() as { id: string }[]) {
        recalcularSaldoCuentaCorriente(db, id);
      }
    }
    o.alAplicar?.(aplicados);
    for (const v of sqlite.pragma('foreign_key_check') as { table: string; rowid: number }[]) {
      if (tablas.has(v.table)) throw new Error(`SNAPSHOT_FK_ROTA: ${v.table}`);
      sqlite.prepare(`DELETE FROM ${q(v.table)} WHERE rowid = ?`).run(v.rowid);
    }
    sqlite.prepare('DELETE FROM "sync_outbox"').run();
    escribirCursor(db, snapshot.cursor);
    return { filas: aplicados.length };
  });
}
