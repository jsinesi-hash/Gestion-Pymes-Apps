import path from 'node:path';
import { app } from 'electron';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '@core/db';
import type { RestoreValidationResult } from '@ferreteria/shared';
import { getSession } from '../auth/session';
import { validarBackup, ejecutarRestoreAtomico } from '../backup/restore-engine';
import { RestoreSwapError, rutaDeBaseDeDatos } from '../backup/swap-bd';

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
  /** El Supervisor aceptó restaurar un backup cuya firma no se puede verificar (ADR-135). */
  confirmarSinFirma?: boolean;
}

export interface RestoreOpts {
  /** Carpeta de migraciones Drizzle de la app (la misma que usa su `db/client`). */
  migrationsFolder: string;
}

export async function restoreEjecutarHandler(
  db: Db,
  payload: RestoreEjecutarPayload,
  opts: RestoreOpts,
): Promise<{ row_counts_antes: Record<string, number>; row_counts_despues: Record<string, number> }> {
  const session = requireSupervisor();

  let resultado;
  try {
    resultado = await ejecutarRestoreAtomico({
      db,
      // Revisión 2026-10-20 (P0): la ruta sale de la propia conexión. Antes era
      // `userData/ferreteria.db` fijo y Elaborados (`elaborados.db`) fallaba el swap con la
      // conexión ya cerrada.
      dbPath: rutaDeBaseDeDatos(db),
      fbkPath: payload.ruta,
      usuarioId: session.userId,
      migrationsFolder: opts.migrationsFolder,
      ...(payload.password ? { password: payload.password } : {}),
      ...(payload.confirmarSinFirma === true ? { confirmarSinFirma: true } : {}),
    });
  } catch (e) {
    if (e instanceof RestoreSwapError) {
      console.error('[restore] swap fallido, conexión cerrada:', e.message);
      // Con la BD original en su lugar, reiniciar es seguro y deja la app operativa. Se difiere
      // para que el renderer alcance a mostrar el error. Si el rollback también falló NO se
      // reinicia: abriría una BD vacía; la original está en `e.bakPath`.
      if (e.code === 'RESTORE_SWAP_FALLIDO') {
        setTimeout(() => { app.relaunch(); app.exit(0); }, REINICIO_TRAS_SWAP_FALLIDO_MS);
      }
    }
    throw e;
  }

  app.relaunch();
  app.exit(0);

  return resultado;
}

const REINICIO_TRAS_SWAP_FALLIDO_MS = 5000;

// ─── Registro ─────────────────────────────────────────────────────────────────

export function registerRestoreHandlers(ipcMain: IpcMain, db: Db, opts: RestoreOpts): void {
  ipcMain.handle('restore:validar',  async (_e, p) => restoreValidarHandler(db, p));
  ipcMain.handle('restore:ejecutar', async (_e, p) => restoreEjecutarHandler(db, p, opts));
}
