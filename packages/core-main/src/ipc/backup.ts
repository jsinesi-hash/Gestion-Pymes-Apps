import fs from 'node:fs';
import path from 'node:path';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@core/db';
import type { BackupListItem, PoliticaRetencion, ResumenDepuracion } from '@ferreteria/shared';
import { getSession } from '../auth/session';
import { crearBackup, listarBackups, calcularCandidatosDepuracion, leerManifestBackup } from '../backup/engine';
import { parametrosGetHandler } from './parametros';

type Db = BetterSQLite3Database<typeof schema>;

function requirePermission(codigo: string): void {
  const session = getSession();
  if (!session?.permisos.has(codigo)) throw new Error('FORBIDDEN');
}

function leerNumero(db: Db, clave: string, def: number): number {
  const v = parametrosGetHandler(db, { clave });
  const n = v ? Number.parseInt(v, 10) : def;
  return Number.isNaN(n) || n < 0 ? def : n;
}

export function leerPolitica(db: Db): PoliticaRetencion {
  return {
    cantidad: leerNumero(db, 'backup_retencion_cantidad', 10),
    dias:     leerNumero(db, 'backup_retencion_dias', 30),
    // El piso es la "red" que garantiza no quedarse sin backups: nunca por debajo de 1,
    // aunque el parámetro se haya configurado en 0 (el min=1 de la UI no valida el backend).
    piso:     Math.max(1, leerNumero(db, 'backup_retencion_piso', 3)),
    sizeMb:   leerNumero(db, 'backup_retencion_size_mb', 0),
  };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export interface BackupEjecutarPayload {
  tipo: 'manual' | 'auto';
  destino: string;
  appVersion: string;
  sucursalId: string;
  incluirCerts?: boolean;
  password?: string;
}

export async function backupEjecutarHandler(db: Db, payload: BackupEjecutarPayload): Promise<string> {
  requirePermission('backup.crear');

  const { tipo, destino, appVersion, sucursalId, incluirCerts = false, password } = payload;

  fs.mkdirSync(destino, { recursive: true });

  const ruta = await crearBackup({ db, destino, tipo, incluirCerts, appVersion, sucursalId, ...(password ? { password } : {}) });

  return ruta;
}

export async function backupListarHandler(
  _db: Db,
  payload: { directorio: string },
): Promise<BackupListItem[]> {
  return listarBackups(payload.directorio);
}

export async function backupEliminarHandler(_db: Db, payload: { ruta: string }): Promise<void> {
  requirePermission('backup.crear');

  if (!payload.ruta.endsWith('.fbk')) throw new Error('INVALID_PATH');

  if (fs.existsSync(payload.ruta)) {
    fs.unlinkSync(payload.ruta);
  }
}

// ─── Trigger auto backup (llamado desde caja:cerrar) ─────────────────────────

export async function triggerAutoBackup(
  db: Db,
  opts: { appVersion: string; sucursalId: string; destino: string },
): Promise<void> {
  const { appVersion, sucursalId, destino } = opts;
  if (!destino) return;

  try {
    fs.mkdirSync(destino, { recursive: true });
    await crearBackup({ db, destino, tipo: 'auto', incluirCerts: false, appVersion, sucursalId });
    console.log('[backup-auto] completado');
  } catch (e) {
    console.error('[backup-auto] error:', e);
  }
}

// ─── Evaluar depuración ───────────────────────────────────────────────────────

export async function evaluarDepuracionCore(
  db: Db, dirs: string[], politica: PoliticaRetencion,
): Promise<ResumenDepuracion> {
  const todos: BackupListItem[] = [];
  // Dedup por ruta absoluta: si dos carpetas configuradas resuelven a la misma (p.ej.
  // backup_destino_local apuntando a la carpeta de pre-migration), no contar doble.
  const dirsUnicos = [...new Set(dirs.filter(Boolean).map(d => path.resolve(d)))];
  for (const dir of dirsUnicos) {
    const lista = await listarBackups(dir);
    for (const b of lista) todos.push(b);
  }
  return calcularCandidatosDepuracion(todos, politica);
}

async function carpetasConocidas(db: Db): Promise<string[]> {
  const dirs: string[] = [];
  try {
    const { app } = await import('electron');
    dirs.push(path.join(app.getPath('userData'), 'backups', 'pre-migration'));
  } catch { /* fuera de Electron (no debería en runtime) */ }
  const destino = parametrosGetHandler(db, { clave: 'backup_destino_local' });
  if (destino) dirs.push(destino);
  return dirs;
}

export async function evaluarDepuracionHandler(db: Db): Promise<ResumenDepuracion> {
  requirePermission('backup.crear');
  const dirs = await carpetasConocidas(db);
  return evaluarDepuracionCore(db, dirs, leerPolitica(db));
}

// ─── Depurar (borrado confirmado por el Supervisor, re-validado server-side) ──

export interface BackupDepurarPayload { rutas: string[] }

export async function backupDepurarHandler(
  db: Db, payload: BackupDepurarPayload,
): Promise<{ eliminados: number; bytesLiberados: number }> {
  requirePermission('backup.crear');
  const conocidas = (await carpetasConocidas(db)).map(d => path.resolve(d));
  let eliminados = 0;
  let bytesLiberados = 0;

  for (const ruta of payload.rutas ?? []) {
    try {
      if (!ruta.endsWith('.fbk')) continue;
      const carpeta = path.resolve(path.dirname(ruta));
      if (!conocidas.includes(carpeta)) continue;
      const manifest = await leerManifestBackup(ruta);
      if (!manifest || manifest.tipo !== 'auto') continue; // nunca borra manual
      const bytes = fs.statSync(ruta).size;
      fs.unlinkSync(ruta);
      eliminados += 1;
      bytesLiberados += bytes;
    } catch {
      // archivo ya borrado / ilegible -> saltar
    }
  }
  return { eliminados, bytesLiberados };
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export function registerBackupHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('backup:ejecutar', async (_e, p: BackupEjecutarPayload) => backupEjecutarHandler(db, p));
  ipcMain.handle('backup:listar',   async (_e, p: { directorio: string }) => backupListarHandler(db, p));
  ipcMain.handle('backup:eliminar', async (_e, p: { ruta: string })       => backupEliminarHandler(db, p));
  ipcMain.handle('backup:evaluarDepuracion', async () => evaluarDepuracionHandler(db));
  ipcMain.handle('backup:depurar', async (_e, p: BackupDepurarPayload) => backupDepurarHandler(db, p));
}
