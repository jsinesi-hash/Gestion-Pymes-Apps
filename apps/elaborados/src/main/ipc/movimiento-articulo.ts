import { eq, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId, requirePermission, str, num, optStr, oneOf, requireSession } from '@core/main';
import * as schema from '../db/schema';
import { costoPromedioEntrada } from '../domain/costo';

type Db = BetterSQLite3Database<typeof schema>;

export function movimientoArticuloListHandler(db: Db, payload: { articulo_id: string }) {
  requireSession();
  return db.select().from(schema.movimiento_articulo)
    .where(eq(schema.movimiento_articulo.articulo_id, payload.articulo_id))
    .orderBy(desc(schema.movimiento_articulo.fecha))
    .all();
}

const MOTIVOS_AJUSTE = ['conteo', 'merma', 'compra'] as const;

const TIPO_POR_MOTIVO: Record<(typeof MOTIVOS_AJUSTE)[number], 'entrada' | 'salida' | 'ajuste'> = {
  compra: 'entrada',
  merma: 'salida',
  conteo: 'ajuste',
};

export function movimientoArticuloCreateHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_articulo_id = str(p['articulo_id'], 'articulo_id');
  const v_motivo = oneOf(p['motivo'], 'motivo', MOTIVOS_AJUSTE);
  const v_cantidad = num(p['cantidad'], 'cantidad');
  const v_costo_unitario_centavos = p['costo_unitario_centavos'] == null
    ? null
    : num(p['costo_unitario_centavos'], 'costo_unitario_centavos', { min: 0 });
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 500);

  const art = db.select().from(schema.articulo).where(eq(schema.articulo.id, v_articulo_id)).get();
  if (!art) throw new Error('NOT_FOUND');
  const ex = db.select().from(schema.existencia_articulo)
    .where(eq(schema.existencia_articulo.articulo_id, v_articulo_id)).get();
  if (!ex) throw new Error('NOT_FOUND');

  const stock_resultante = ex.stock + v_cantidad;
  if (art.bloquea_sin_stock && stock_resultante < 0) throw new Error('STOCK_INSUFICIENTE');

  const now = new Date();
  const id = generateId();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const tipo = TIPO_POR_MOTIVO[v_motivo];

  const nuevoCostoPromedio =
    v_cantidad > 0 && v_costo_unitario_centavos != null
      ? costoPromedioEntrada(ex.stock, art.costo_promedio_centavos, v_cantidad, v_costo_unitario_centavos)
      : art.costo_promedio_centavos;

  db.transaction((tx) => {
    tx.insert(schema.movimiento_articulo).values({
      id,
      articulo_id: v_articulo_id,
      tipo,
      motivo: v_motivo,
      cantidad: v_cantidad,
      stock_resultante,
      costo_unitario_centavos: v_costo_unitario_centavos,
      referencia_tipo: 'ajuste_manual',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      observaciones: v_observaciones ?? null,
      ...sync,
    }).run();

    tx.update(schema.existencia_articulo).set({
      stock: stock_resultante,
      ultima_fecha_movimiento: now,
      version: ex.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.existencia_articulo.articulo_id, v_articulo_id)).run();

    tx.update(schema.articulo).set({
      costo_promedio_centavos: nuevoCostoPromedio,
      version: art.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.articulo.id, v_articulo_id)).run();
  });

  return db.select().from(schema.movimiento_articulo).where(eq(schema.movimiento_articulo.id, id)).get()!;
}

export function registerMovimientoArticuloHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('stock.ajustar');
  ipcMain.handle('movimiento-articulo:list', async (_e, p) => movimientoArticuloListHandler(db, p));
  ipcMain.handle('movimiento-articulo:create', guard(async (_e, p) => movimientoArticuloCreateHandler(db, p)));
}
