import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId, requirePermission, str, num, bool, oneOf, id as vId, requireSession } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;
export type ArticuloRow = typeof schema.articulo.$inferSelect;

export function articuloListHandler(db: Db) {
  requireSession();
  return db.select({
    id: schema.articulo.id,
    nombre: schema.articulo.nombre,
    tipo: schema.articulo.tipo,
    unidad: schema.articulo.unidad,
    bloquea_sin_stock: schema.articulo.bloquea_sin_stock,
    stock_minimo: schema.articulo.stock_minimo,
    costo_promedio_centavos: schema.articulo.costo_promedio_centavos,
    activo: schema.articulo.activo,
    stock: schema.existencia_articulo.stock,
  })
    .from(schema.articulo)
    .leftJoin(schema.existencia_articulo, eq(schema.existencia_articulo.articulo_id, schema.articulo.id))
    .all();
}

export function articuloGetHandler(db: Db, payload: { id: string }) {
  requireSession();
  return db.select().from(schema.articulo).where(eq(schema.articulo.id, payload.id)).get() ?? null;
}

export function articuloCreateHandler(db: Db, payload: unknown): ArticuloRow {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_nombre = str(p['nombre'], 'nombre', { max: 120 });
  const v_tipo = oneOf(p['tipo'], 'tipo', ['insumo', 'elaborado', 'reventa'] as const);
  const v_unidad = oneOf(p['unidad'], 'unidad', ['kg', 'l', 'u'] as const);
  const v_bloquea = bool(p['bloquea_sin_stock'], 'bloquea_sin_stock');
  const v_stock_minimo = p['stock_minimo'] == null ? null : num(p['stock_minimo'], 'stock_minimo', { min: 0 });

  const now = new Date();
  const id = generateId();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.transaction((tx) => {
    tx.insert(schema.articulo).values({
      id,
      nombre: v_nombre,
      tipo: v_tipo,
      unidad: v_unidad,
      bloquea_sin_stock: v_bloquea,
      stock_minimo: v_stock_minimo,
      costo_promedio_centavos: 0,
      activo: true,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      ...sync,
    }).run();

    tx.insert(schema.existencia_articulo).values({
      id: generateId(),
      articulo_id: id,
      stock: 0,
      ultima_fecha_movimiento: now,
      ...sync,
    }).run();

    tx.insert(schema.movimiento_articulo).values({
      id: generateId(),
      articulo_id: id,
      tipo: 'entrada',
      motivo: 'inicial',
      cantidad: 0,
      stock_resultante: 0,
      costo_unitario_centavos: null,
      referencia_tipo: 'alta_articulo',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      observaciones: null,
      ...sync,
    }).run();
  });

  return db.select().from(schema.articulo).where(eq(schema.articulo.id, id)).get()!;
}

export function articuloUpdateHandler(db: Db, payload: unknown): ArticuloRow {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = vId(p['id'], 'id');
  const existing = db.select().from(schema.articulo).where(eq(schema.articulo.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');

  const now = new Date();
  db.update(schema.articulo).set({
    nombre: p['nombre'] != null ? str(p['nombre'], 'nombre', { max: 120 }) : existing.nombre,
    bloquea_sin_stock: p['bloquea_sin_stock'] != null ? bool(p['bloquea_sin_stock'], 'bloquea_sin_stock') : existing.bloquea_sin_stock,
    stock_minimo: p['stock_minimo'] !== undefined
      ? (p['stock_minimo'] == null ? null : num(p['stock_minimo'], 'stock_minimo', { min: 0 }))
      : existing.stock_minimo,
    activo: p['activo'] != null ? bool(p['activo'], 'activo') : existing.activo,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.articulo.id, v_id)).run();

  return db.select().from(schema.articulo).where(eq(schema.articulo.id, v_id)).get()!;
}

export function registerArticuloHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('articulo.gestionar');
  ipcMain.handle('articulo:list', async () => articuloListHandler(db));
  ipcMain.handle('articulo:get', async (_e, p) => articuloGetHandler(db, p));
  ipcMain.handle('articulo:create', guard(async (_e, p) => articuloCreateHandler(db, p)));
  ipcMain.handle('articulo:update', guard(async (_e, p) => articuloUpdateHandler(db, p)));
}
