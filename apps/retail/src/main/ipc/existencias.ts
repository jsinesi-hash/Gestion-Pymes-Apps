import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { num, id as vId } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

export function existenciasGetHandler(db: Db, payload: { producto_id: string }) {
  const ex = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, payload.producto_id)).get();
  if (!ex) return null;
  return { ...ex, stock_disponible: ex.stock_fisico - (ex.stock_reservado ?? 0) };
}

export function existenciasSetMinimosHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const producto_id = vId(p['producto_id'], 'producto_id');
  // Present-only: sólo type-checamos si el campo viene. Ausente = no se toca (stock_minimo
  // es NOT NULL default 0; omitirlo del set deja el valor previo). No lo hacemos requerido.
  const stock_minimo = p['stock_minimo'] == null ? undefined : num(p['stock_minimo'], 'stock_minimo');
  const stock_maximo = p['stock_maximo'] == null ? undefined : num(p['stock_maximo'], 'stock_maximo');
  const ex = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, producto_id)).get();
  if (!ex) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.existencias).set({
    ...(stock_minimo !== undefined ? { stock_minimo } : {}),
    stock_maximo: stock_maximo ?? null,
    version: ex.version + 1,
    sync_state: 'pending',
    updated_at: now,
    origin_id: getOriginId(),
  }).where(eq(schema.existencias.producto_id, producto_id)).run();
}

export function registerExistenciasHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('existencias:get', async (_e, p) => existenciasGetHandler(db, p));
  ipcMain.handle('existencias:set-minimos', async (_e, p) => existenciasSetMinimosHandler(db, p));
}
