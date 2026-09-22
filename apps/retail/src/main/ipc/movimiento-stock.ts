import { eq, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export type CreateMovimientoPayload = {
  producto_id: string;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  motivo: 'ajuste_conteo' | 'merma_rotura' | 'devolucion';
  cantidad: number;
  costo_unitario?: number;
  observaciones?: string;
};

export function movimientoStockListHandler(db: Db, payload: { producto_id: string }) {
  return db.select().from(schema.movimiento_stock)
    .where(eq(schema.movimiento_stock.producto_id, payload.producto_id))
    .orderBy(desc(schema.movimiento_stock.fecha))
    .all();
}

export function movimientoStockCreateHandler(db: Db, payload: CreateMovimientoPayload) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const ex = db.select().from(schema.existencias)
    .where(eq(schema.existencias.producto_id, payload.producto_id))
    .get();
  if (!ex) throw new Error('NOT_FOUND');

  const now = new Date();
  const id = generateId();
  const stock_resultante = ex.stock_fisico + payload.cantidad;
  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  db.transaction((tx) => {
    tx.insert(schema.movimiento_stock).values({
      id,
      producto_id: payload.producto_id,
      tipo: payload.tipo,
      motivo: payload.motivo,
      cantidad: payload.cantidad,
      stock_resultante,
      costo_unitario: payload.costo_unitario ?? null,
      referencia_tipo: 'ajuste_manual',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      observaciones: payload.observaciones ?? null,
      ...sync,
    }).run();

    tx.update(schema.existencias).set({
      stock_fisico: stock_resultante,
      ultima_fecha_movimiento: now,
      version: ex.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.existencias.producto_id, payload.producto_id)).run();
  });

  return db.select().from(schema.movimiento_stock).where(eq(schema.movimiento_stock.id, id)).get()!;
}

export function registerMovimientoStockHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('movimiento-stock:list', async (_e, p) => movimientoStockListHandler(db, p));
  ipcMain.handle('movimiento-stock:create', async (_e, p) => movimientoStockCreateHandler(db, p));
}
