import path from 'node:path';
import { app } from 'electron';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';
import type { RestoreValidationResult } from '@ferreteria/shared';
import { getSession } from '../auth/session';
import { validarBackup, ejecutarRestoreAtomico } from '../backup/restore-engine';

type Db = BetterSQLite3Database<typeof schema>;

function requireSupervisor() {
  const session = getSession();
  if (!session?.permisos.has('backup.restaurar')) throw new Error('FORBIDDEN');
  return session!;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function restoreValidarHandler(
  db: Db,
  payload: { ruta: string; password?: string },
): Promise<RestoreValidationResult> {
  requireSupervisor();
  return validarBackup(db, payload);
}

export interface RestoreEjecutarPayload {
  ruta: string;
  password?: string;
}

export async function restoreEjecutarHandler(
  db: Db,
  payload: RestoreEjecutarPayload,
): Promise<{ row_counts_antes: Record<string, number>; row_counts_despues: Record<string, number> }> {
  const session = requireSupervisor();

  const resultado = await ejecutarRestoreAtomico({
    db,
    dbPath: path.join(app.getPath('userData'), 'ferreteria.db'),
    fbkPath: payload.ruta,
    usuarioId: session.userId,
    migrationsFolder: path.join(__dirname, '../db/migrations'),
    ...(payload.password ? { password: payload.password } : {}),
  });

  app.relaunch();
  app.exit(0);

  return resultado;
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export function registerRestoreHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('restore:validar',  async (_e, p) => restoreValidarHandler(db, p));
  ipcMain.handle('restore:ejecutar', async (_e, p) => restoreEjecutarHandler(db, p));
}
