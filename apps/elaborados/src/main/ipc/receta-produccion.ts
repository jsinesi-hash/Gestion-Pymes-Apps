import { and, eq, isNull, sql } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId, requirePermission, num, arr, id as vId, requireSession } from '@core/main';
import * as schema from '../db/schema';

/** Ítems vivos de una receta (ADR-150 §7: los que salieron quedan con lápida). */
export function itemsVivos(recetaId: string) {
  return and(eq(schema.receta_produccion_item.receta_produccion_id, recetaId), isNull(schema.receta_produccion_item.deleted_at));
}

type Db = BetterSQLite3Database<typeof schema>;

export function recetaProduccionGetHandler(db: Db, payload: { articulo_id: string }) {
  requireSession();
  const receta = db.select().from(schema.receta_produccion)
    .where(eq(schema.receta_produccion.articulo_id, payload.articulo_id)).get();
  if (!receta) return null;
  const items = db.select().from(schema.receta_produccion_item)
    .where(itemsVivos(receta.id)).all();
  return { ...receta, items };
}

export function recetaProduccionSetHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_articulo_id = vId(p['articulo_id'], 'articulo_id');
  const v_rinde = num(p['rinde_cantidad'], 'rinde_cantidad', { min: 0.001 });
  const v_items = arr(p['items'], 'items', (x) => {
    const o = x as Record<string, unknown>;
    return {
      articulo_id: vId(o['articulo_id'], 'items.articulo_id'),
      cantidad: num(o['cantidad'], 'items.cantidad', { min: 0.001 }),
    };
  });
  if (v_items.length === 0) throw new Error('VALIDATION:items:REQUERIDO');

  const art = db.select().from(schema.articulo).where(eq(schema.articulo.id, v_articulo_id)).get();
  if (!art || art.tipo !== 'elaborado') throw new Error('ARTICULO_NO_ELABORADO');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const existing = db.select().from(schema.receta_produccion)
    .where(eq(schema.receta_produccion.articulo_id, v_articulo_id)).get();

  db.transaction((tx) => {
    let recetaId: string;
    if (existing) {
      recetaId = existing.id;
      tx.update(schema.receta_produccion).set({
        rinde_cantidad: v_rinde, version: existing.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.receta_produccion.id, recetaId)).run();
    } else {
      recetaId = generateId();
      tx.insert(schema.receta_produccion).values({
        id: recetaId, articulo_id: v_articulo_id, rinde_cantidad: v_rinde, ...sync,
      }).run();
    }
    // ADR-150 §7: el ítem de un artículo que sigue en la receta se actualiza en el lugar (mismo id),
    // los nuevos se insertan y los que salen quedan con lápida.
    const vivos = tx.select().from(schema.receta_produccion_item).where(itemsVivos(recetaId)).all();
    for (const item of v_items) {
      const i = vivos.findIndex((v) => v.articulo_id === item.articulo_id);
      if (i < 0) {
        tx.insert(schema.receta_produccion_item).values({
          id: generateId(), receta_produccion_id: recetaId,
          articulo_id: item.articulo_id, cantidad: item.cantidad, ...sync,
        }).run();
        continue;
      }
      const [actual] = vivos.splice(i, 1);
      if (actual.cantidad !== item.cantidad) {
        tx.update(schema.receta_produccion_item).set({
          cantidad: item.cantidad, version: actual.version + 1, sync_state: 'pending', updated_at: now,
        }).where(eq(schema.receta_produccion_item.id, actual.id)).run();
      }
    }
    for (const sale of vivos) {
      tx.update(schema.receta_produccion_item).set({
        deleted_at: now, version: sql`${schema.receta_produccion_item.version} + 1`, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.receta_produccion_item.id, sale.id)).run();
    }
  });

  return recetaProduccionGetHandler(db, { articulo_id: v_articulo_id });
}

export function registerRecetaProduccionHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('receta.gestionar');
  ipcMain.handle('receta-produccion:get', async (_e, p) => recetaProduccionGetHandler(db, p));
  ipcMain.handle('receta-produccion:set', guard(async (_e, p) => recetaProduccionSetHandler(db, p)));
}
