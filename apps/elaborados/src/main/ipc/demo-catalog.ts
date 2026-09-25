import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getSession } from '@core/main';
import * as schema from '../db/schema';
import { runDemoHeladeriaSeed } from '../catalog/demo-heladeria';

type Db = BetterSQLite3Database<typeof schema>;

// Mismo patrón que apps/retail/src/main/ipc/demo-catalog.ts: sembrado a demanda (no en cada
// arranque como el catálogo fiscal), gateado por el permiso de administración — el seed demo
// es para verificar navegando, no para producción.
function requireAdmin() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  return session;
}

export function demoHeladeriaSeedHandler(db: Db): { ok: true } {
  requireAdmin();
  runDemoHeladeriaSeed(db);
  return { ok: true };
}

export function registerDemoCatalogHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('demo-catalog:seed-heladeria', async () => demoHeladeriaSeedHandler(db));
}
