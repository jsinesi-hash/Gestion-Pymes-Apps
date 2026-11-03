import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@core/db';
import type { BackupManifest, RestoreCompatibilidad, RestoreFirma, RestoreValidationResult } from '@ferreteria/shared';
import { verificarFirma, type FirmaFbk } from './firma';
import { claveFirmaActual } from './firma-config';
import { crearBackup, descifrarAES } from './engine';
import { intercambiarBaseDeDatos } from './swap-bd';

type Db = BetterSQLite3Database<typeof schema>;

// ─── determinarCompatibilidad ─────────────────────────────────────────────────

export function determinarCompatibilidad(
  backupLastHash: string,
  currentHashes: string[],
): RestoreCompatibilidad {
  if (currentHashes.length === 0) return 'incompatible';
  const lastCurrent = currentHashes.at(-1);
  if (backupLastHash === lastCurrent) return 'direct';
  if (currentHashes.includes(backupLastHash)) return 'migrate';
  return 'incompatible';
}

function leerMigracionesActuales(db: Db): string[] {
  const sqlite = (db as any).$client;
  const rows = sqlite.prepare(
    'SELECT hash FROM __drizzle_migrations ORDER BY created_at ASC'
  ).all() as Array<{ hash: string }>;
  return rows.map((r: { hash: string }) => r.hash);
}

export function leerRowCountsActuales(db: Db): Record<string, number> {
  const sqlite = (db as any).$client;
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as Array<{ name: string }>;
  const counts: Record<string, number> = {};
  for (const { name } of tables) {
    const row = sqlite.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number };
    counts[name] = row.c;
  }
  return counts;
}

// ─── validarBackup ────────────────────────────────────────────────────────────

interface ValidarOpts {
  ruta: string;
  password?: string;
}

async function loadDbBufferFromZip(
  zip: JSZip,
  manifest: BackupManifest,
  password?: string,
): Promise<{ buffer: Buffer } | { error: string }> {
  if (!manifest.cifrado) {
    const dbFile = zip.file('ferreteria.db');
    if (!dbFile) return { error: 'No se encontró ferreteria.db en el backup' };
    return { buffer: await dbFile.async('nodebuffer') };
  }
  if (!password) return { error: 'Este backup está cifrado. Ingresá la contraseña para continuar.' };
  const dataEncFile = zip.file('data.enc');
  if (!dataEncFile) return { error: 'Backup cifrado sin data.enc (archivo corrupto)' };
  try {
    const encBuffer = await dataEncFile.async('nodebuffer');
    const innerZipBuffer = descifrarAES(encBuffer, password);
    const innerZip = await JSZip.loadAsync(innerZipBuffer);
    const dbFile = innerZip.file('ferreteria.db');
    if (!dbFile) return { error: 'No se encontró ferreteria.db en el backup cifrado' };
    return { buffer: await dbFile.async('nodebuffer') };
  } catch {
    return { error: 'Contraseña incorrecta o contenido cifrado dañado' };
  }
}

export async function validarBackup(db: Db, opts: ValidarOpts): Promise<RestoreValidationResult> {
  const { ruta, password } = opts;

  if (!fs.existsSync(ruta)) {
    return { ok: false, error: 'Archivo no encontrado' };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(ruta));
  } catch {
    return { ok: false, error: 'El archivo está dañado o no es un backup válido' };
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    return { ok: false, error: 'El archivo no contiene manifest.json (backup inválido)' };
  }

  let manifest: BackupManifest;
  const manifestJson = await manifestFile.async('string');
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    return { ok: false, error: 'El manifest está corrupto' };
  }

  // ADR-135: firma HMAC. Un mac que no coincide con la clave de ESTA instalación es un archivo
  // modificado y se rechaza; firmado por otra instalación o sin firma se informa y el restore
  // exige una confirmación explícita.
  const firmaFile = zip.file('firma.json');
  let firmaLeida: FirmaFbk | null = null;
  if (firmaFile) {
    try { firmaLeida = JSON.parse(await firmaFile.async('string')); } catch { firmaLeida = null; }
  }
  const resultadoFirma = verificarFirma(claveFirmaActual(), manifestJson, firmaLeida);
  if (resultadoFirma === 'invalida') {
    return {
      ok: false,
      error: 'La firma del backup no coincide: el archivo fue modificado después de crearse. No se puede restaurar.',
      manifest,
    };
  }
  const firma: RestoreFirma = resultadoFirma;

  const bufferResult = await loadDbBufferFromZip(zip, manifest, password);
  if ('error' in bufferResult) return { ok: false, error: bufferResult.error };
  const dbBuffer = bufferResult.buffer;

  const sha256Actual = crypto.createHash('sha256').update(dbBuffer).digest('hex');
  if (sha256Actual !== manifest.db_sha256) {
    return { ok: false, error: 'El archivo está dañado o incompleto (checksum no coincide)' };
  }

  const migracionesActuales = leerMigracionesActuales(db);
  const compatibilidad = determinarCompatibilidad(
    manifest.schema.last_migration_hash,
    migracionesActuales,
  );

  if (compatibilidad === 'incompatible') {
    return {
      ok: false,
      error: 'Este backup fue creado con una versión más nueva de la aplicación. Actualizá la app antes de restaurar.',
      manifest,
      compatibilidad,
    };
  }

  return {
    ok: true,
    manifest,
    compatibilidad,
    firma,
    row_counts_actuales: leerRowCountsActuales(db),
  };
}

// ─── ejecutarRestoreAtomico ───────────────────────────────────────────────────

export interface RestoreAtomicoResult {
  row_counts_antes: Record<string, number>;
  row_counts_despues: Record<string, number>;
}

export interface EjecutarRestoreOpts {
  db: Db;
  dbPath: string;
  fbkPath: string;
  password?: string;
  usuarioId: string;
  migrationsFolder: string;
  preRestoreDestino?: string;
  /** Confirmación explícita del Supervisor para restaurar un backup sin firma verificable. */
  confirmarSinFirma?: boolean;
}

export async function ejecutarRestoreAtomico(opts: EjecutarRestoreOpts): Promise<RestoreAtomicoResult> {
  const { db, dbPath, fbkPath, password, usuarioId, migrationsFolder } = opts;

  const validacion = await validarBackup(db, { ruta: fbkPath, ...(password ? { password } : {}) });
  if (!validacion.ok) throw new Error(validacion.error ?? 'Validación fallida');
  // ADR-135: sin firma verificable no se restaura sin que el Supervisor lo confirme.
  if (validacion.firma !== 'valida' && !opts.confirmarSinFirma) throw new Error('FIRMA_NO_VERIFICABLE');

  const manifest = validacion.manifest!;
  const rowCountsAntes = leerRowCountsActuales(db);

  // Extraer DB buffer del .fbk
  const zip = await JSZip.loadAsync(fs.readFileSync(fbkPath));
  let dbBuffer: Buffer;

  if (manifest.cifrado) {
    const encBuffer = await zip.file('data.enc')!.async('nodebuffer');
    const innerZipBuffer = descifrarAES(encBuffer, password!);
    const innerZip = await JSZip.loadAsync(innerZipBuffer);
    dbBuffer = await innerZip.file('ferreteria.db')!.async('nodebuffer');
  } else {
    dbBuffer = await zip.file('ferreteria.db')!.async('nodebuffer');
  }

  // Backup pre-restore AUTOMÁTICO Y OBLIGATORIO (ADR-022)
  const preRestoreDir = opts.preRestoreDestino ?? path.dirname(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const preRestorePath = path.join(preRestoreDir, `pre-restore_${timestamp}.fbk`);
  const fbkTmp = await crearBackup({
    db,
    destino: preRestoreDir,
    tipo: 'manual',
    incluirCerts: false,
    appVersion: 'pre-restore',
    sucursalId: 'local',
  });
  fs.renameSync(fbkTmp, preRestorePath);

  // Escribir DB restaurada a temporal
  const restoreTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const tempRestoring = path.join(restoreTmpDir, 'ferreteria.db.restoring');

  try {
    fs.writeFileSync(tempRestoring, dbBuffer);

    // PRAGMA integrity_check sobre la copia temporal
    const tempSqlite = new Database(tempRestoring);
    const integrityResult = tempSqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (integrityResult.integrity_check !== 'ok') {
      tempSqlite.close();
      throw new Error(`La base de datos del backup está corrupta: ${integrityResult.integrity_check}`);
    }

    // Si es subconjunto, correr migraciones sobre la copia
    if (validacion.compatibilidad === 'migrate') {
      const tempDrizzle = drizzle(tempSqlite, {});
      migrate(tempDrizzle, { migrationsFolder });
    }

    // Leer row_counts del backup restaurado
    const tempTables = tempSqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    const rowCountsDespues: Record<string, number> = {};
    for (const { name } of tempTables) {
      const row = tempSqlite.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number };
      rowCountsDespues[name] = row.c;
    }

    // integrity_check final
    const finalIntegrity = tempSqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    tempSqlite.close();
    if (finalIntegrity.integrity_check !== 'ok') {
      throw new Error('La base de datos restaurada no pasó la verificación de integridad final');
    }

    // Cerrar conexión actual + swap atómico. Si falla lanza RestoreSwapError (la conexión ya
    // está cerrada: el handler IPC decide si reiniciar la app o dejarla como está).
    intercambiarBaseDeDatos({
      dbPath,
      tempPath: tempRestoring,
      cerrarConexion: () => ((db as any).$client).close(),
    });

    // Auditoría: insertar en restore_log (ADR-022) sobre la DB ya restaurada
    try {
      const auditSqlite = new Database(dbPath);
      auditSqlite.prepare(`
        INSERT INTO restore_log
          (id, fecha, usuario_id, archivo_origen, manifest_backup, row_counts_antes, row_counts_despues, resultado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        new Date().toISOString(),
        usuarioId,
        fbkPath,
        JSON.stringify(manifest),
        JSON.stringify(rowCountsAntes),
        JSON.stringify(rowCountsDespues),
        'exito',
      );
      auditSqlite.close();
    } catch (auditErr) {
      // Best-effort: el restore ya fue exitoso, no interrumpir por falla de log
      console.error('[restore] error escribiendo restore_log:', auditErr);
    }

    return { row_counts_antes: rowCountsAntes, row_counts_despues: rowCountsDespues };

  } finally {
    try { fs.rmSync(restoreTmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
