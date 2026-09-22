import { eq, and, ne } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, bool, id, num, optId, optStr } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-085 (SEC-2): factor_a_stock debe ser estrictamente positivo (un factor 0 o negativo
// nunca puede convertir presentación → stock). Tope inferior mínimo, no de negocio.
const FACTOR_A_STOCK_MIN = 0.001;

// Shared by productoCreate and importar masiva — call inside an existing transaction.
export function crearPresentacionDefault(
  tx: Db,
  productoId: string,
  unidadAbreviatura: string,
  userId: string,
  originId: string,
): string {
  const now = new Date();
  const unidad = tx.select({ id: schema.unidad.id })
    .from(schema.unidad)
    .where(eq(schema.unidad.abreviatura, unidadAbreviatura))
    .get();
  if (!unidad) throw new Error(`UNIDAD_NOT_FOUND:${unidadAbreviatura}`);
  const id = generateId();
  tx.insert(schema.producto_presentacion).values({
    id,
    producto_id: productoId,
    unidad_id: unidad.id,
    factor_a_stock: 1.0,
    gtin_barcode: null,
    es_default: true,
    activo: true,
    sin_confirmar: false,
    version: 1,
    origin_id: originId,
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return id;
}

// Returns the id of the active default presentation for a product, or null.
export function getDefaultPresentacionId(db: Db, productoId: string): string | null {
  const pp = db.select({ id: schema.producto_presentacion.id })
    .from(schema.producto_presentacion)
    .where(and(
      eq(schema.producto_presentacion.producto_id, productoId),
      eq(schema.producto_presentacion.es_default, true),
      eq(schema.producto_presentacion.activo, true),
    ))
    .get();
  return pp?.id ?? null;
}

export function presentacionListByProductoHandler(db: Db, payload: { producto_id: string }) {
  return db.select({
    id:                schema.producto_presentacion.id,
    producto_id:       schema.producto_presentacion.producto_id,
    unidad_id:         schema.producto_presentacion.unidad_id,
    unidad_nombre:     schema.unidad.nombre,
    unidad_abreviatura: schema.unidad.abreviatura,
    factor_a_stock:    schema.producto_presentacion.factor_a_stock,
    gtin_barcode:      schema.producto_presentacion.gtin_barcode,
    es_default:        schema.producto_presentacion.es_default,
    activo:            schema.producto_presentacion.activo,
    sin_confirmar:     schema.producto_presentacion.sin_confirmar,
  })
    .from(schema.producto_presentacion)
    .innerJoin(schema.unidad, eq(schema.unidad.id, schema.producto_presentacion.unidad_id))
    .where(eq(schema.producto_presentacion.producto_id, payload.producto_id))
    .all();
}

export function presentacionCreateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_producto_id = id(p['producto_id'], 'producto_id');
  const v_unidad_id = id(p['unidad_id'], 'unidad_id');
  const v_factor_a_stock = num(p['factor_a_stock'], 'factor_a_stock', { min: FACTOR_A_STOCK_MIN });
  const v_gtin_barcode = optStr(p['gtin_barcode'], 'gtin_barcode', 20);

  // ADR-068: el índice ux_pp_gtin sólo cubre presentaciones activas; una nueva nace activa,
  // así que su GTIN no puede colisionar con otra activa (mensaje amigable en vez del error
  // crudo de SQLite). No hay id propio que excluir.
  if (v_gtin_barcode) {
    const colision = db.select({ id: schema.producto_presentacion.id })
      .from(schema.producto_presentacion)
      .where(and(
        eq(schema.producto_presentacion.gtin_barcode, v_gtin_barcode),
        eq(schema.producto_presentacion.activo, true),
      ))
      .get();
    if (colision) throw new Error('GTIN_DUPLICADO');
  }
  const now = new Date();
  const nuevoId = generateId();
  db.insert(schema.producto_presentacion).values({
    id: nuevoId,
    producto_id: v_producto_id,
    unidad_id: v_unidad_id,
    factor_a_stock: v_factor_a_stock,
    gtin_barcode: v_gtin_barcode ?? null,
    es_default: false,
    activo: true,
    sin_confirmar: false,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, nuevoId)).get()!;
}

export function presentacionUpdateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde. gtin_barcode puede venir explícitamente en null
  // para limpiar el campo — se distingue por presencia de la clave ('gtin_barcode' in p),
  // no por su valor, igual que antes.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const v_unidad_id = optId(p['unidad_id'], 'unidad_id');
  const v_factor_a_stock = p['factor_a_stock'] == null
    ? undefined : num(p['factor_a_stock'], 'factor_a_stock', { min: FACTOR_A_STOCK_MIN });
  const gtinProvisto = 'gtin_barcode' in p;
  const v_gtin_barcode = gtinProvisto && p['gtin_barcode'] != null
    ? (optStr(p['gtin_barcode'], 'gtin_barcode', 20) ?? null) : null;
  const v_sin_confirmar = p['sin_confirmar'] == null
    ? undefined : bool(p['sin_confirmar'], 'sin_confirmar');

  const existing = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  // ADR-068: si se setea un GTIN no nulo sobre una presentación activa, chequear colisión
  // contra otras activas (el índice sólo cubre activas; una inactiva puede llevar cualquier
  // GTIN). Excluye el propio id. Consistente con el guard de reactivar.
  if (gtinProvisto && existing.activo && v_gtin_barcode) {
    const colision = db.select({ id: schema.producto_presentacion.id })
      .from(schema.producto_presentacion)
      .where(and(
        eq(schema.producto_presentacion.gtin_barcode, v_gtin_barcode),
        eq(schema.producto_presentacion.activo, true),
        ne(schema.producto_presentacion.id, v_id),
      ))
      .get();
    if (colision) throw new Error('GTIN_DUPLICADO');
  }
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  };
  if (v_unidad_id !== undefined) updates.unidad_id = v_unidad_id;
  if (v_factor_a_stock !== undefined) updates.factor_a_stock = v_factor_a_stock;
  if (gtinProvisto) updates.gtin_barcode = v_gtin_barcode;
  if (v_sin_confirmar !== undefined) updates.sin_confirmar = v_sin_confirmar;
  db.update(schema.producto_presentacion).set(updates)
    .where(eq(schema.producto_presentacion.id, v_id)).run();
  return db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get()!;
}

export function presentacionSetDefaultHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const target = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get();
  if (!target) throw new Error('NOT_FOUND');
  if (!target.activo) throw new Error('INACTIVO');
  const now = new Date();
  db.transaction(tx => {
    tx.update(schema.producto_presentacion)
      .set({ es_default: false, updated_at: now, sync_state: 'pending' })
      .where(eq(schema.producto_presentacion.producto_id, target.producto_id))
      .run();
    tx.update(schema.producto_presentacion)
      .set({ es_default: true, version: target.version + 1, updated_at: now, sync_state: 'pending' })
      .where(eq(schema.producto_presentacion.id, v_id))
      .run();
  });
}

export function presentacionDesactivarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const existing = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.es_default) throw new Error('NO_DESACTIVAR_DEFAULT');
  const now = new Date();
  db.update(schema.producto_presentacion).set({
    activo: false,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.producto_presentacion.id, v_id)).run();
}

// ADR-066: ¿la presentación fue usada en algún documento? (FK que la referencian)
function presentacionTieneHistorial(db: Db, presentacionId: string): boolean {
  const check = (table: any) => !!db.select({ id: table.id })
    .from(table)
    .where(eq(table.presentacion_id, presentacionId))
    .get();
  return check(schema.venta_detalle)
    || check(schema.lista_precio_valor)
    || check(schema.presupuesto_detalle)
    || check(schema.price_batch_detalle);
}

export function presentacionEliminarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const existing = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.es_default) throw new Error('NO_ELIMINAR_DEFAULT');

  if (presentacionTieneHistorial(db, v_id)) {
    const now = new Date();
    db.update(schema.producto_presentacion).set({
      activo: false,
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.producto_presentacion.id, v_id)).run();
    return { eliminada: false as const };
  }

  db.delete(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).run();
  return { eliminada: true as const };
}

export function presentacionReactivarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const existing = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');

  if (existing.gtin_barcode) {
    const colision = db.select({ id: schema.producto_presentacion.id })
      .from(schema.producto_presentacion)
      .where(and(
        eq(schema.producto_presentacion.gtin_barcode, existing.gtin_barcode),
        eq(schema.producto_presentacion.activo, true),
        ne(schema.producto_presentacion.id, v_id),
      ))
      .get();
    if (colision) throw new Error('GTIN_DUPLICADO');
  }

  const now = new Date();
  db.update(schema.producto_presentacion).set({
    activo: true,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.producto_presentacion.id, v_id)).run();
}

// Scan resolution: presentacion.gtin_barcode first, then producto.gtin_barcode → default.
export function presentacionBuscarPorGtinHandler(db: Db, payload: { gtin: string }) {
  const pp = db.select({
    presentacion_id: schema.producto_presentacion.id,
    producto_id:     schema.producto_presentacion.producto_id,
    factor_a_stock:  schema.producto_presentacion.factor_a_stock,
    es_default:      schema.producto_presentacion.es_default,
  })
    .from(schema.producto_presentacion)
    .where(and(
      eq(schema.producto_presentacion.gtin_barcode, payload.gtin),
      eq(schema.producto_presentacion.activo, true),
    ))
    .get();
  if (pp) return pp;

  const prod = db.select({ id: schema.producto.id })
    .from(schema.producto)
    .where(and(
      eq(schema.producto.gtin_barcode, payload.gtin),
      eq(schema.producto.activo, true),
    ))
    .get();
  if (!prod) return null;

  return db.select({
    presentacion_id: schema.producto_presentacion.id,
    producto_id:     schema.producto_presentacion.producto_id,
    factor_a_stock:  schema.producto_presentacion.factor_a_stock,
    es_default:      schema.producto_presentacion.es_default,
  })
    .from(schema.producto_presentacion)
    .where(and(
      eq(schema.producto_presentacion.producto_id, prod.id),
      eq(schema.producto_presentacion.es_default, true),
      eq(schema.producto_presentacion.activo, true),
    ))
    .get() ?? null;
}

export function registerPresentacionHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('presentacion:listByProducto', async (_e, p) =>
    presentacionListByProductoHandler(db, p));
  ipcMain.handle('presentacion:create',         async (_e, p) =>
    presentacionCreateHandler(db, p));
  ipcMain.handle('presentacion:update',         async (_e, p) =>
    presentacionUpdateHandler(db, p));
  ipcMain.handle('presentacion:setDefault',     async (_e, p) =>
    presentacionSetDefaultHandler(db, p));
  ipcMain.handle('presentacion:desactivar',     async (_e, p) =>
    presentacionDesactivarHandler(db, p));
  ipcMain.handle('presentacion:eliminar',       async (_e, p) =>
    presentacionEliminarHandler(db, p));
  ipcMain.handle('presentacion:reactivar',      async (_e, p) =>
    presentacionReactivarHandler(db, p));
  ipcMain.handle('presentacion:buscarPorGtin',  async (_e, p) =>
    presentacionBuscarPorGtinHandler(db, p));
}
