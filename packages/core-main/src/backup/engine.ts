import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@core/db';
import type { BackupManifest, BackupListItem, PoliticaRetencion, ResumenDepuracion } from '@ferreteria/shared';

type Db = BetterSQLite3Database<typeof schema>;

// ─── Helpers internos ────────────────────────────────────────────────────────

function toArgentinaISO(date: Date): string {
  const offsetMs = -3 * 60 * 60 * 1000;
  const localDate = new Date(date.getTime() + offsetMs);
  return localDate.toISOString().replaceAll('Z', '-03:00');
}

function sha256Hex(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// AES-256-GCM autenticado — detecta manipulación y corrupción de transferencia
// Formato: [salt(32)][iv(12)][authTag(16)][encrypted]
function cifrarAES(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

export function descifrarAES(data: Buffer, password: string): Buffer {
  const salt = data.subarray(0, 32);
  const iv = data.subarray(32, 44);
  const authTag = data.subarray(44, 60);
  const encrypted = data.subarray(60);
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Manifest ────────────────────────────────────────────────────────────────

interface ManifestOpts {
  tipo: 'manual' | 'auto';
  incluirCerts: boolean;
  appVersion: string;
  sucursalId: string;
  dbSha256: string;
}

export function generarManifest(db: Db, opts: ManifestOpts): BackupManifest {
  const sqlite = (db as any).$client;

  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as Array<{ name: string }>;

  const row_counts: Record<string, number> = {};
  for (const { name } of tables) {
    const row = sqlite.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number };
    row_counts[name] = row.c;
  }

  const migrations = sqlite.prepare(
    'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at ASC'
  ).all() as Array<{ hash: string; created_at: number }>;

  const lastMig = migrations.at(-1);

  return {
    app_version: opts.appVersion,
    created_at: toArgentinaISO(new Date()),
    sucursal_id: opts.sucursalId,
    db_sha256: opts.dbSha256,
    row_counts,
    incluye_certs: opts.incluirCerts,
    cifrado: opts.incluirCerts,
    tipo: opts.tipo,
    schema: {
      driver: 'drizzle',
      last_migration_hash: lastMig?.hash ?? '',
      migrations_applied: migrations.length,
      last_migration_at: lastMig ? toArgentinaISO(new Date(Number(lastMig.created_at))) : '',
    },
  };
}

// ─── Backup de DB ─────────────────────────────────────────────────────────────

async function backupDb(db: Db, destPath: string): Promise<void> {
  // Checkpoint WAL: garantiza que el .fbk sea autocontenido (no depende de -wal externo)
  ((db as any).$client).pragma('wal_checkpoint(TRUNCATE)');
  // Online Backup API de better-sqlite3 — safe para escrituras concurrentes (ADR-021)
  await ((db as any).$client).backup(destPath);
}

// ─── crearBackup ──────────────────────────────────────────────────────────────

export interface CrearBackupOpts {
  db: Db;
  destino: string;
  tipo: 'manual' | 'auto';
  incluirCerts: boolean;
  password?: string;
  appVersion: string;
  sucursalId: string;
  certsDir?: string;
}

export async function crearBackup(opts: CrearBackupOpts): Promise<string> {
  const { db, destino, tipo, incluirCerts, password, appVersion, sucursalId } = opts;

  if (incluirCerts && !password) throw new Error('PASSWORD_REQUIRED');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbk-'));
  const tempDbPath = path.join(tmpDir, 'ferreteria.db');

  try {
    // 1. Crear copia limpia con Online Backup API (checkpoint WAL incluido)
    await backupDb(db, tempDbPath);
    const dbBuffer = fs.readFileSync(tempDbPath);
    const dbSha256 = sha256Hex(dbBuffer);

    // 2. Generar manifest
    const manifest = generarManifest(db, { tipo, incluirCerts, appVersion, sucursalId, dbSha256 });

    // 3. Armar checksums
    const checksums = `${dbSha256}  ferreteria.db\n`;

    // 4. Crear ZIP outer
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('checksums.sha256', checksums);

    if (incluirCerts) {
      const certsDir = opts.certsDir ?? '';
      const innerZip = new JSZip();
      innerZip.file('ferreteria.db', dbBuffer);

      if (fs.existsSync(certsDir)) {
        const certFiles = fs.readdirSync(certsDir);
        for (const certFile of certFiles) {
          const certPath = path.join(certsDir, certFile);
          if (fs.statSync(certPath).isFile()) {
            innerZip.file(`certs/${certFile}`, fs.readFileSync(certPath));
          }
        }
      }

      const innerBuffer = await innerZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const encrypted = cifrarAES(innerBuffer, password!);
      zip.file('data.enc', encrypted);
    } else {
      zip.file('ferreteria.db', dbBuffer);
    }

    // 5. Escribir .fbk al destino
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nombre = `ferreteria-backup-${timestamp}-${tipo}.fbk`;
    const rutaFbk = path.join(destino, nombre);

    const fbkBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(rutaFbk, fbkBuffer);

    return rutaFbk;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── listarBackups ────────────────────────────────────────────────────────────

export async function listarBackups(directorio: string): Promise<BackupListItem[]> {
  if (!fs.existsSync(directorio)) return [];

  const archivos = fs.readdirSync(directorio).filter(f => f.endsWith('.fbk'));
  const lista: BackupListItem[] = [];

  for (const nombre of archivos) {
    const ruta = path.join(directorio, nombre);
    try {
      const stat = fs.statSync(ruta);
      const zipData = fs.readFileSync(ruta);
      const zip = await JSZip.loadAsync(zipData);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) continue;
      const manifest: BackupManifest = JSON.parse(await manifestFile.async('string'));

      lista.push({
        ruta,
        nombre,
        tamano_bytes: stat.size,
        fecha: manifest.created_at,
        tipo: manifest.tipo,
        incluye_certs: manifest.incluye_certs,
        cifrado: manifest.cifrado,
        app_version: manifest.app_version,
      });
    } catch {
      // archivo corrupto o ilegible — saltar
    }
  }

  lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return lista;
}

// ─── leerManifestBackup ────────────────────────────────────────────────────────

export async function leerManifestBackup(ruta: string): Promise<BackupManifest | null> {
  try {
    if (!fs.existsSync(ruta)) return null;
    const zip = await JSZip.loadAsync(fs.readFileSync(ruta));
    const mf = zip.file('manifest.json');
    if (!mf) return null;
    return JSON.parse(await mf.async('string')) as BackupManifest;
  } catch {
    return null;
  }
}

// ─── calcularCandidatosDepuracion ─────────────────────────────────────────────
//
// Función pura, sin efectos: no toca DB ni filesystem. Determina, dado un
// listado plano de backups (posiblemente de varias carpetas) y una política
// de retención, cuáles 'auto' son candidatos a depuración y cuáles quedan
// protegidos. Los 'manual' nunca son candidatos. La protección de un 'auto'
// es la UNIÓN de: estar entre los últimos N, estar dentro de los últimos X
// días, o el piso absoluto por carpeta (nunca se viola). Un tope de tamaño
// opcional por carpeta (sizeMb, 0 = desactivado) libera luego los 'auto'
// protegidos más viejos, sin bajar del piso.

function carpetaDe(item: BackupListItem): string {
  return path.dirname(item.ruta);
}

export function calcularCandidatosDepuracion(
  backups: BackupListItem[],
  politica: PoliticaRetencion,
): ResumenDepuracion {
  const ahora = Date.now();
  const umbralMs = politica.dias * 86400000;

  const porCarpetaMap = new Map<string, BackupListItem[]>();
  for (const b of backups) {
    const carpeta = carpetaDe(b);
    const arr = porCarpetaMap.get(carpeta) ?? [];
    arr.push(b);
    porCarpetaMap.set(carpeta, arr);
  }

  const candidatos: BackupListItem[] = [];
  const protegidos: BackupListItem[] = [];
  const porCarpeta: Record<string, { candidatos: number; bytes: number }> = {};

  for (const [carpeta, itemsCarpeta] of porCarpetaMap) {
    porCarpeta[carpeta] = { candidatos: 0, bytes: 0 };

    const manuales = itemsCarpeta.filter(b => b.tipo === 'manual');
    for (const m of manuales) protegidos.push(m);

    const autos = itemsCarpeta
      .filter(b => b.tipo === 'auto')
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const kept: BackupListItem[] = [];
    const localCand: BackupListItem[] = [];
    autos.forEach((b, idx) => {
      const dentroDeN = idx < Math.max(politica.cantidad, politica.piso);
      const dentroDeDias = ahora - new Date(b.fecha).getTime() <= umbralMs;
      if (dentroDeN || dentroDeDias) kept.push(b);
      else localCand.push(b);
    });

    if (politica.sizeMb > 0) {
      const topeBytes = politica.sizeMb * 1024 * 1024;
      const sumBytes = (arr: BackupListItem[]) => arr.reduce((s, x) => s + x.tamano_bytes, 0);
      let totalCarpeta = sumBytes(manuales) + sumBytes(kept);
      while (totalCarpeta > topeBytes && kept.length > politica.piso) {
        const viejo = kept.pop()!;
        localCand.push(viejo);
        totalCarpeta -= viejo.tamano_bytes;
      }
    }

    for (const k of kept) protegidos.push(k);
    for (const c of localCand) {
      candidatos.push(c);
      porCarpeta[carpeta].candidatos += 1;
      porCarpeta[carpeta].bytes += c.tamano_bytes;
    }
  }

  const bytesALiberar = candidatos.reduce((s, c) => s + c.tamano_bytes, 0);
  return { candidatos, protegidos, bytesALiberar, porCarpeta };
}
