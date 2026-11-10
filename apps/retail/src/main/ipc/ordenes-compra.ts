import { eq, and, gt, sql } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getOriginId, requirePermission, id, optStr, str, num, centavos, oneOf, requireSession } from '@core/main';

const OC_TIPO = ['manual', 'sugerida'] as const;

type Db = BetterSQLite3Database<typeof schema>;

function nextNumeroOC(db: Db, terminal: string): string {
  const clave = `oc_correlativo_${terminal}`;
  const param = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave))
    .get();
  if (!param) throw new Error('OC_CORRELATIVO_NOT_FOUND');
  const correlativo = Number.parseInt(param.valor) + 1;
  db.update(schema.parametros_sistema)
    .set({ valor: String(correlativo), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, clave))
    .run();
  return `OC-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

function recalcularTotalesOC(db: Db, ocId: string) {
  const items = db.select().from(schema.item_oc)
    .where(eq(schema.item_oc.orden_compra_id, ocId))
    .all();

  let subtotal = 0;
  let iva = 0;
  for (const item of items) {
    subtotal += item.subtotal_centavos;
    iva += Math.round(item.subtotal_centavos * item.alicuota_iva / 100);
  }

  db.update(schema.orden_compra).set({
    subtotal_centavos:    subtotal,
    importe_iva_centavos: iva,
    total_centavos:       subtotal + iva,
    fecha_actualizacion:  new Date(),
    updated_at:           new Date(),
  }).where(eq(schema.orden_compra.id, ocId)).run();
}

export function ocCrearHandler(db: Db, payload: unknown) {
  const session = requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_proveedor_id = id(p['proveedor_id'], 'proveedor_id');
  const v_tipo = oneOf(p['tipo'], 'tipo', OC_TIPO);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);

  const now = new Date();
  const terminal = getOriginId();
  const numero_interno = nextNumeroOC(db, terminal);
  const newId = generateId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  db.insert(schema.orden_compra).values({
    id: newId,
    numero_interno,
    proveedor_id:    v_proveedor_id,
    tipo:            v_tipo,
    estado:          'borrador',
    fecha:           now,
    observaciones:   v_observaciones ?? null,
    subtotal_centavos:    0,
    importe_iva_centavos: 0,
    total_centavos:       0,
    usuario_id:              session.userId,
    usuario_creacion_id:     session.userId,
    fecha_creacion:          now,
    ...sync,
  }).run();

  return { id: newId, numero_interno };
}

export function ocGetHandler(db: Db, id: string) {
  requireSession();
  const oc = db.select({
    id:                   schema.orden_compra.id,
    numero_interno:       schema.orden_compra.numero_interno,
    proveedor_id:         schema.orden_compra.proveedor_id,
    razon_social:         schema.proveedor.razon_social,
    tipo:                 schema.orden_compra.tipo,
    estado:               schema.orden_compra.estado,
    fecha:                schema.orden_compra.fecha,
    fecha_entrega_estimada: schema.orden_compra.fecha_entrega_estimada,
    subtotal_centavos:    schema.orden_compra.subtotal_centavos,
    importe_iva_centavos: schema.orden_compra.importe_iva_centavos,
    total_centavos:       schema.orden_compra.total_centavos,
    observaciones:        schema.orden_compra.observaciones,
  })
    .from(schema.orden_compra)
    .innerJoin(schema.proveedor, eq(schema.orden_compra.proveedor_id, schema.proveedor.id))
    .where(eq(schema.orden_compra.id, id))
    .get();

  if (!oc) return null;

  const items = db.select().from(schema.item_oc)
    .where(eq(schema.item_oc.orden_compra_id, id))
    .all();

  return { ...oc, items };
}

export function ocListHandler(db: Db) {
  requireSession();
  return db.select({
    id:             schema.orden_compra.id,
    numero_interno: schema.orden_compra.numero_interno,
    proveedor_id:   schema.orden_compra.proveedor_id,
    razon_social:   schema.proveedor.razon_social,
    tipo:           schema.orden_compra.tipo,
    estado:         schema.orden_compra.estado,
    fecha:          schema.orden_compra.fecha,
    total_centavos: schema.orden_compra.total_centavos,
  })
    .from(schema.orden_compra)
    .innerJoin(schema.proveedor, eq(schema.orden_compra.proveedor_id, schema.proveedor.id))
    .all();
}

export function ocAgregarItemHandler(db: Db, payload: unknown) {
  requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_orden_compra_id = id(p['orden_compra_id'], 'orden_compra_id');
  const v_producto_id = id(p['producto_id'], 'producto_id');
  const v_descripcion = str(p['descripcion'], 'descripcion', { max: 300 });
  const v_cantidad_pedida = num(p['cantidad_pedida'], 'cantidad_pedida', { min: 0 });
  const v_costo_unitario_centavos = centavos(p['costo_unitario_centavos'], 'costo_unitario_centavos');
  const v_alicuota_iva = num(p['alicuota_iva'], 'alicuota_iva', { min: 0, max: 100 });

  const now = new Date();
  const newId = generateId();
  const subtotal_centavos = Math.round(v_cantidad_pedida * v_costo_unitario_centavos);
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.insert(schema.item_oc).values({
    id: newId,
    orden_compra_id:         v_orden_compra_id,
    producto_id:             v_producto_id,
    descripcion:             v_descripcion,
    cantidad_pedida:         v_cantidad_pedida,
    cantidad_recibida:       0,
    costo_unitario_centavos: v_costo_unitario_centavos,
    alicuota_iva:            v_alicuota_iva,
    subtotal_centavos,
    ...sync,
  }).run();

  recalcularTotalesOC(db, v_orden_compra_id);
  return { id: newId };
}

export function ocActualizarItemHandler(db: Db, payload: unknown) {
  requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD. Los tres campos son
  // opcionales (actualización parcial); se validan sólo cuando vienen presentes.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_item_id = id(p['item_id'], 'item_id');
  const v_cantidad_pedida = p['cantidad_pedida'] != null
    ? num(p['cantidad_pedida'], 'cantidad_pedida', { min: 0 })
    : undefined;
  const v_costo_unitario_centavos = p['costo_unitario_centavos'] != null
    ? centavos(p['costo_unitario_centavos'], 'costo_unitario_centavos')
    : undefined;
  const v_alicuota_iva = p['alicuota_iva'] != null
    ? num(p['alicuota_iva'], 'alicuota_iva', { min: 0, max: 100 })
    : undefined;

  const item = db.select().from(schema.item_oc)
    .where(eq(schema.item_oc.id, v_item_id))
    .get();
  if (!item) return { id: v_item_id };

  const nuevaCantidad = v_cantidad_pedida           ?? item.cantidad_pedida;
  const nuevoCosto    = v_costo_unitario_centavos   ?? item.costo_unitario_centavos;
  const nuevaIva      = v_alicuota_iva              ?? item.alicuota_iva;
  const subtotal_centavos = Math.round(nuevaCantidad * nuevoCosto);

  db.update(schema.item_oc).set({
    cantidad_pedida:         nuevaCantidad,
    costo_unitario_centavos: nuevoCosto,
    alicuota_iva:            nuevaIva,
    subtotal_centavos,
    updated_at: new Date(),
  }).where(eq(schema.item_oc.id, v_item_id)).run();

  recalcularTotalesOC(db, item.orden_compra_id);
  return { id: v_item_id };
}

export function ocEliminarItemHandler(db: Db, itemId: string) {
  requireSession();
  const item = db.select({ orden_compra_id: schema.item_oc.orden_compra_id })
    .from(schema.item_oc)
    .where(eq(schema.item_oc.id, itemId))
    .get();

  db.delete(schema.item_oc).where(eq(schema.item_oc.id, itemId)).run();

  if (item) recalcularTotalesOC(db, item.orden_compra_id);
  return { id: itemId };
}

export function ocEmitirHandler(db: Db, id: string) {
  requireSession();
  const oc = db.select({ estado: schema.orden_compra.estado })
    .from(schema.orden_compra)
    .where(eq(schema.orden_compra.id, id))
    .get();
  if (oc?.estado !== 'borrador') throw new Error('OC_NO_BORRADOR');

  db.update(schema.orden_compra).set({
    estado:              'emitida',
    fecha_actualizacion: new Date(),
    updated_at:          new Date(),
  }).where(eq(schema.orden_compra.id, id)).run();

  return { id };
}

export function ocAnularHandler(db: Db, id: string) {
  requireSession();
  db.update(schema.orden_compra).set({
    estado:              'anulada',
    fecha_actualizacion: new Date(),
    updated_at:          new Date(),
  }).where(eq(schema.orden_compra.id, id)).run();
  return { id };
}

export type OcSugeridaGrupo = {
  proveedor_id: string;
  razon_social: string;
  items: Array<{
    producto_id: string;
    nombre_corto: string;
    cantidad_sugerida_uv: number;
    costo_centavos: number;
    codigo_proveedor: string | null;
    stock_minimo: number;
    stock_fisico: number;
    unidad_compra: string | null;
  }>;
};

export function ocSugerirHandler(db: Db): { grupos: OcSugeridaGrupo[]; sin_proveedor: Array<{ producto_id: string; nombre_corto: string; cantidad_sugerida_uv: number; stock_minimo: number; stock_fisico: number; unidad_compra: string | null }> } {
  requireSession();

  const bajoMinimo = db.select({
    id:               schema.producto.id,
    nombre_corto:     schema.producto.nombre_corto,
    unidad_compra:    schema.producto.unidad_compra,
    stock_fisico:     schema.existencias.stock_fisico,
    stock_minimo:     schema.existencias.stock_minimo,
    stock_maximo:     schema.existencias.stock_maximo,
  })
    .from(schema.producto)
    .innerJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(and(
      eq(schema.producto.activo, true),
      gt(schema.existencias.stock_minimo, 0),
      sql`${schema.existencias.stock_fisico} <= ${schema.existencias.stock_minimo}`,
    ))
    .all();

  const gruposMap = new Map<string, OcSugeridaGrupo>();
  const sin_proveedor: Array<{ producto_id: string; nombre_corto: string; cantidad_sugerida_uv: number; stock_minimo: number; stock_fisico: number; unidad_compra: string | null }> = [];

  for (const prod of bajoMinimo) {
    const cantidad_sugerida_uv =
      prod.stock_maximo != null && prod.stock_maximo > 0
        ? prod.stock_maximo - prod.stock_fisico
        : prod.stock_minimo;

    const pp = db.select({
      proveedor_id:     schema.producto_proveedor.proveedor_id,
      razon_social:     schema.proveedor.razon_social,
      costo_centavos:   schema.producto_proveedor.costo_centavos,
      codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
    })
      .from(schema.producto_proveedor)
      .innerJoin(schema.proveedor, eq(schema.producto_proveedor.proveedor_id, schema.proveedor.id))
      .where(and(
        eq(schema.producto_proveedor.producto_id, prod.id),
        eq(schema.producto_proveedor.preferido, true),
      ))
      .get();

    if (!pp) {
      sin_proveedor.push({
        producto_id:         prod.id,
        nombre_corto:        prod.nombre_corto,
        cantidad_sugerida_uv,
        stock_minimo:        prod.stock_minimo,
        stock_fisico:        prod.stock_fisico,
        unidad_compra:       prod.unidad_compra,
      });
      continue;
    }

    if (!gruposMap.has(pp.proveedor_id)) {
      gruposMap.set(pp.proveedor_id, { proveedor_id: pp.proveedor_id, razon_social: pp.razon_social, items: [] });
    }
    gruposMap.get(pp.proveedor_id)!.items.push({
      producto_id:         prod.id,
      nombre_corto:        prod.nombre_corto,
      cantidad_sugerida_uv,
      costo_centavos:      pp.costo_centavos,
      codigo_proveedor:    pp.codigo_proveedor,
      stock_minimo:        prod.stock_minimo,
      stock_fisico:        prod.stock_fisico,
      unidad_compra:       prod.unidad_compra,
    });
  }

  return { grupos: Array.from(gruposMap.values()), sin_proveedor };
}

export function registerOcHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('proveedor.gestionar');
  const guardRecibir = requirePermission('compra.recibir');
  ipcMain.handle('compras.oc:list',           guardRecibir(async () => ocListHandler(db)));
  ipcMain.handle('compras.oc:get',            guardRecibir(async (_e, id) => ocGetHandler(db, id)));
  ipcMain.handle('compras.oc:crear',          guard(async (_e, p) => ocCrearHandler(db, p)));
  ipcMain.handle('compras.oc:agregarItem',    guard(async (_e, p) => ocAgregarItemHandler(db, p)));
  ipcMain.handle('compras.oc:actualizarItem', guard(async (_e, p) => ocActualizarItemHandler(db, p)));
  ipcMain.handle('compras.oc:eliminarItem',   guard(async (_e, id) => ocEliminarItemHandler(db, id)));
  ipcMain.handle('compras.oc:emitir',         guard(async (_e, id) => ocEmitirHandler(db, id)));
  ipcMain.handle('compras.oc:anular',         guard(async (_e, id) => ocAnularHandler(db, id)));
  ipcMain.handle('compras.oc:sugerir',        guardRecibir(async () => ocSugerirHandler(db)));
}
