import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gt, lte, or, asc } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, str, optStr, num, id as vId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export type StockEntradaPayload = {
  producto_id: string;
  cantidad: number;
  costo_unitario?: number;
  observaciones?: string;
};

export type StockAjustePayload = {
  producto_id: string;
  cantidad_contada: number;
  observaciones: string;
};

export type StockMermaPayload = {
  producto_id: string;
  cantidad: number;
  observaciones: string;
};

export function stockEntradaHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const p = (payload ?? {}) as Record<string, unknown>;
  const producto_id = vId(p['producto_id'], 'producto_id');
  const cantidad = num(p['cantidad'], 'cantidad');
  const costo_unitario = p['costo_unitario'] === undefined ? undefined : num(p['costo_unitario'], 'costo_unitario');
  const observaciones = optStr(p['observaciones'], 'observaciones');

  if (cantidad <= 0) throw new Error('CANTIDAD_INVALIDA');

  const ex = db.select().from(schema.existencias)
    .where(eq(schema.existencias.producto_id, producto_id))
    .get();
  if (!ex) throw new Error('NOT_FOUND');

  const prod = db.select().from(schema.producto)
    .where(eq(schema.producto.id, producto_id))
    .get();
  if (!prod) throw new Error('NOT_FOUND');

  const now = new Date();
  const id = generateId();
  const stockResultante = ex.stock_fisico + cantidad;

  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  return db.transaction((tx) => {
    // Recalculate CPP if costo_unitario provided and > 0
    if (costo_unitario !== undefined && costo_unitario > 0) {
      const nuevoCpp =
        (ex.stock_fisico * prod.precio_costo_promedio + cantidad * costo_unitario) /
        stockResultante;

      tx.update(schema.producto)
        .set({
          precio_costo_promedio: nuevoCpp,
          version: prod.version + 1,
          sync_state: 'pending',
          updated_at: now,
        })
        .where(eq(schema.producto.id, producto_id))
        .run();
    }

    tx.insert(schema.movimiento_stock).values({
      id,
      producto_id: producto_id,
      tipo: 'entrada',
      motivo: 'entrada_manual',
      cantidad: cantidad,
      stock_resultante: stockResultante,
      costo_unitario: costo_unitario ?? null,
      referencia_tipo: 'entrada_manual',
      referencia_id: id, // referencia_id = movement's own id for manual entries (no originating document)
      usuario_id: session.userId,
      fecha: now,
      observaciones: observaciones ?? null,
      ...sync,
    }).run();

    tx.update(schema.existencias)
      .set({
        stock_fisico: stockResultante,
        ultima_fecha_movimiento: now,
        version: ex.version + 1,
        sync_state: 'pending',
        updated_at: now,
      })
      .where(eq(schema.existencias.producto_id, producto_id))
      .run();

    return tx.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.id, id))
      .get()!;
  });
}

export function stockAjusteHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const p = (payload ?? {}) as Record<string, unknown>;
  const producto_id = vId(p['producto_id'], 'producto_id');
  const cantidad_contada = num(p['cantidad_contada'], 'cantidad_contada');
  const observaciones = str(p['observaciones'], 'observaciones');

  const ex = db.select().from(schema.existencias)
    .where(eq(schema.existencias.producto_id, producto_id))
    .get();
  if (!ex) throw new Error('NOT_FOUND');

  const delta = cantidad_contada - ex.stock_fisico;
  if (delta === 0) throw new Error('NO_CHANGE');

  const now = new Date();
  const id = generateId();

  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  return db.transaction((tx) => {
    tx.insert(schema.movimiento_stock).values({
      id,
      producto_id: producto_id,
      tipo: 'ajuste',
      motivo: 'ajuste_conteo',
      cantidad: delta,
      stock_resultante: cantidad_contada,
      costo_unitario: null,
      referencia_tipo: 'ajuste_conteo',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      observaciones: observaciones,
      ...sync,
    }).run();

    tx.update(schema.existencias)
      .set({
        stock_fisico: cantidad_contada,
        ultima_fecha_movimiento: now,
        version: ex.version + 1,
        sync_state: 'pending',
        updated_at: now,
      })
      .where(eq(schema.existencias.producto_id, producto_id))
      .run();

    return tx.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.id, id))
      .get()!;
  });
}

export function stockMermaHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const p = (payload ?? {}) as Record<string, unknown>;
  const producto_id = vId(p['producto_id'], 'producto_id');
  const cantidad = num(p['cantidad'], 'cantidad');
  const observaciones = str(p['observaciones'], 'observaciones');

  const ex = db.select().from(schema.existencias)
    .where(eq(schema.existencias.producto_id, producto_id))
    .get();
  if (!ex) throw new Error('NOT_FOUND');

  if (ex.stock_fisico - cantidad < 0) throw new Error('STOCK_INSUFICIENTE');

  const stockResultante = ex.stock_fisico - cantidad;
  const now = new Date();
  const id = generateId();

  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  return db.transaction((tx) => {
    tx.insert(schema.movimiento_stock).values({
      id,
      producto_id: producto_id,
      tipo: 'salida',
      motivo: 'merma_rotura',
      cantidad: -cantidad,
      stock_resultante: stockResultante,
      costo_unitario: null,
      referencia_tipo: 'merma_rotura',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      observaciones: observaciones,
      ...sync,
    }).run();

    tx.update(schema.existencias)
      .set({
        stock_fisico: stockResultante,
        ultima_fecha_movimiento: now,
        version: ex.version + 1,
        sync_state: 'pending',
        updated_at: now,
      })
      .where(eq(schema.existencias.producto_id, producto_id))
      .run();

    return tx.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.id, id))
      .get()!;
  });
}

export type StockExportFiltros = {
  stock_status?: 'ok' | 'bajo' | 'sin' | 'bajo_sin';
};

export function stockQueryAll(db: Db, filtros: StockExportFiltros = {}) {
  const { stock_status } = filtros;
  const stockStatusClauseBajo = stock_status === 'bajo' ? and(
    gt(schema.existencias.stock_fisico, 0),
    gt(schema.existencias.stock_minimo, 0),
    lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
  ) : stock_status === 'ok' ? and(
    gt(schema.existencias.stock_fisico, 0),
    or(
      eq(schema.existencias.stock_minimo, 0),
      gt(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
    ),
  ) : undefined;
  // ADR-057: 'bajo_sin' = unión de "Sin stock" y "Bajo mínimo".
  const stockStatusClause =
    stock_status === 'sin' ? eq(schema.existencias.stock_fisico, 0)
    : stock_status === 'bajo_sin' ? or(
        eq(schema.existencias.stock_fisico, 0),
        and(
          gt(schema.existencias.stock_fisico, 0),
          gt(schema.existencias.stock_minimo, 0),
          lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
        ),
      )
    : stockStatusClauseBajo;

  return db.select({
    id:                    schema.producto.id,
    sku:                   schema.producto.sku,
    nombre_corto:          schema.producto.nombre_corto,
    precio_costo_promedio: schema.producto.precio_costo_promedio,
    ubicacion_codigo:      schema.ubicacion.codigo,
    stock_fisico:          schema.existencias.stock_fisico,
    stock_minimo:          schema.existencias.stock_minimo,
  })
    .from(schema.producto)
    .innerJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .leftJoin(schema.ubicacion,    eq(schema.ubicacion.id, schema.producto.ubicacion_id))
    .where(and(eq(schema.producto.activo, true), stockStatusClause))
    .orderBy(asc(schema.producto.sku))
    .all();
}

export function registerStockHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('stock:entrada', async (_e, p) => stockEntradaHandler(db, p));
  ipcMain.handle('stock:ajuste',  async (_e, p) => stockAjusteHandler(db, p));
  ipcMain.handle('stock:merma',   (_e, p) => stockMermaHandler(db, p));
}
