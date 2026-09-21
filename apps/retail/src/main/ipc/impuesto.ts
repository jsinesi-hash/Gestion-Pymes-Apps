import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function impuestoListHandler(db: Db) {
  return db.select().from(schema.impuesto).where(eq(schema.impuesto.activo, true)).all();
}

export function registerImpuestoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('impuesto:list', async () => impuestoListHandler(db));
}
