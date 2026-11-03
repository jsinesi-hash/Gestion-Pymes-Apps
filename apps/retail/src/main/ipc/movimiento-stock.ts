import { eq, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function movimientoStockListHandler(db: Db, payload: { producto_id: string }) {
  return db.select().from(schema.movimiento_stock)
    .where(eq(schema.movimiento_stock.producto_id, payload.producto_id))
    .orderBy(desc(schema.movimiento_stock.fecha))
    .all();
}

// Revisión 2026-10-20 (P0): se eliminó `movimiento-stock:create` (sin llamadores en la UI, aceptaba
// tipo/motivo/cantidad arbitrarios con solo sesión). El stock manual pasa por `stock:*`.
export function registerMovimientoStockHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('movimiento-stock:list', async (_e, p) => movimientoStockListHandler(db, p));
}
