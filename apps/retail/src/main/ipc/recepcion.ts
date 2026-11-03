import { eq, and } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getOriginId, requirePermission, id, optStr, num, centavos, arr, requireSession } from '@core/main';
import { crearBatchesPorEventoDeCosto } from '../precios/motor';

type Db = BetterSQLite3Database<typeof schema>;

function actualizarCppYProveedor(
  tx: Db,
  productoId: string,
  costoUnitarioPesos: number | null,
  stockPrevio: number,
  cantidadRecibida: number,
  stockResultante: number,
  proveedorId: string,
  costoRealCentavos: number | null,
  now: Date,
): void {
  if (!costoUnitarioPesos || costoUnitarioPesos <= 0) return;
  const prod = tx.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get();
  if (prod) {
    const nuevoCpp = stockResultante > 0
      ? (stockPrevio * prod.precio_costo_promedio + cantidadRecibida * costoUnitarioPesos) / stockResultante
      : costoUnitarioPesos;
    tx.update(schema.producto).set({
      precio_costo_promedio: nuevoCpp,
      updated_at: now,
      sync_state: 'pending',
    }).where(eq(schema.producto.id, productoId)).run();
  }
  const pp = tx.select({ id: schema.producto_proveedor.id })
    .from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, productoId),
      eq(schema.producto_proveedor.proveedor_id, proveedorId),
    ))
    .get();
  if (pp) {
    tx.update(schema.producto_proveedor).set({
      costo_centavos: costoRealCentavos ?? undefined,
      updated_at: now,
    }).where(eq(schema.producto_proveedor.id, pp.id)).run();
  }
}

export function recepcionCrearHandler(db: Db, payload: unknown) {
  const session = requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_orden_compra_id = id(p['orden_compra_id'], 'orden_compra_id');
  const v_remito_proveedor = optStr(p['remito_proveedor'], 'remito_proveedor', 100);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);
  const v_items = arr(p['items'], 'items', (x, i) => {
    const it = (x ?? {}) as Record<string, unknown>;
    return {
      item_oc_id: id(it['item_oc_id'], `items.${i}.item_oc_id`),
      cantidad_recibida: num(it['cantidad_recibida'], `items.${i}.cantidad_recibida`, { min: 0 }),
      costo_unitario_real_centavos: it['costo_unitario_real_centavos'] == null
        ? undefined
        : centavos(it['costo_unitario_real_centavos'], `items.${i}.costo_unitario_real_centavos`),
    };
  });

  const now = new Date();
  const origin = getOriginId();
  const sync = { version: 1 as const, origin_id: origin, sync_state: 'pending' as const, updated_at: now };

  const oc = db.select().from(schema.orden_compra)
    .where(eq(schema.orden_compra.id, v_orden_compra_id))
    .get();
  if (!(oc && (oc.estado === 'emitida' || oc.estado === 'recibida_parcial'))) {
    throw new Error('OC_NO_EMITIDA');
  }

  const productoIdsConCostoDistinto: string[] = [];

  const resultado = db.transaction((tx) => {
    const recepcionId = generateId();
    tx.insert(schema.recepcion).values({
      id:               recepcionId,
      orden_compra_id:  v_orden_compra_id,
      fecha:            now,
      usuario_id:       session.userId,
      remito_proveedor: v_remito_proveedor ?? null,
      observaciones:    v_observaciones ?? null,
      ...sync,
    }).run();

    for (const item of v_items) {
      const itemOc = tx.select().from(schema.item_oc)
        .where(eq(schema.item_oc.id, item.item_oc_id))
        .get();
      if (!itemOc) continue;

      const costoReal = item.costo_unitario_real_centavos ?? null;

      tx.insert(schema.recepcion_detalle).values({
        id:                           generateId(),
        recepcion_id:                 recepcionId,
        item_oc_id:                   item.item_oc_id,
        cantidad_recibida:            item.cantidad_recibida,
        costo_unitario_real_centavos: costoReal,
        ...sync,
      }).run();

      tx.update(schema.item_oc).set({
        cantidad_recibida: itemOc.cantidad_recibida + item.cantidad_recibida,
        updated_at: now,
      }).where(eq(schema.item_oc.id, item.item_oc_id)).run();

      const ex = tx.select().from(schema.existencias)
        .where(eq(schema.existencias.producto_id, itemOc.producto_id))
        .get();
      if (!ex) continue;

      const stockResultante = ex.stock_fisico + item.cantidad_recibida;
      const costoUnitarioPesos = costoReal != null ? costoReal / 100 : null;

      actualizarCppYProveedor(
        tx, itemOc.producto_id, costoUnitarioPesos,
        ex.stock_fisico, item.cantidad_recibida, stockResultante,
        oc.proveedor_id, costoReal, now,
      );
      if (costoUnitarioPesos != null) productoIdsConCostoDistinto.push(itemOc.producto_id);

      tx.insert(schema.movimiento_stock).values({
        id:               generateId(),
        producto_id:      itemOc.producto_id,
        tipo:             'entrada',
        motivo:           'recepcion_compra',
        cantidad:         item.cantidad_recibida,
        stock_resultante: stockResultante,
        costo_unitario:   costoUnitarioPesos,
        referencia_tipo:  'recepcion',
        referencia_id:    recepcionId,
        usuario_id:       session.userId,
        fecha:            now,
        observaciones:    v_observaciones ?? null,
        ...sync,
      }).run();

      tx.update(schema.existencias).set({
        stock_fisico:           stockResultante,
        ultima_fecha_movimiento: now,
        updated_at: now,
      }).where(eq(schema.existencias.producto_id, itemOc.producto_id)).run();
    }

    // Recalculate OC estado
    const allItems = tx.select({
      cantidad_pedida:   schema.item_oc.cantidad_pedida,
      cantidad_recibida: schema.item_oc.cantidad_recibida,
    })
      .from(schema.item_oc)
      .where(eq(schema.item_oc.orden_compra_id, v_orden_compra_id))
      .all();

    const totalRecibido = allItems.every(i => i.cantidad_recibida >= i.cantidad_pedida);
    const nuevoEstado = totalRecibido ? 'recibida_total' : 'recibida_parcial';

    tx.update(schema.orden_compra).set({
      estado:              nuevoEstado,
      fecha_actualizacion: now,
      updated_at:          now,
    }).where(eq(schema.orden_compra.id, v_orden_compra_id)).run();

    return { id: recepcionId };
  });

  // ADR-049 §7 — recepción con costo distinto dispara un batch en borrador (solo listas
  // en modo margen_costo), acotado a los productos con costo real cargado.
  try {
    crearBatchesPorEventoDeCosto(db, {
      producto_ids: productoIdsConCostoDistinto,
      origen: 'PROVIDER_COST_UPDATE',
      proveedor_id: oc.proveedor_id,
      referencia_tipo: 'recepcion',
      referencia_id: resultado.id,
    }, session.userId);
  } catch (e) {
    console.error('[precios] Error generando batch por recepción:', e);
  }

  return resultado;
}

export function recepcionListByOCHandler(db: Db, ocId: string) {
  requireSession();
  return db.select().from(schema.recepcion)
    .where(eq(schema.recepcion.orden_compra_id, ocId))
    .all();
}

export function recepcionGetHandler(db: Db, recepcionId: string) {
  requireSession();
  const rec = db.select().from(schema.recepcion)
    .where(eq(schema.recepcion.id, recepcionId))
    .get();
  if (!rec) return null;
  const detalles = db.select().from(schema.recepcion_detalle)
    .where(eq(schema.recepcion_detalle.recepcion_id, recepcionId))
    .all();
  return { ...rec, detalles };
}

export function registerRecepcionHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('compra.recibir');
  ipcMain.handle('compras.recepcion:crear',       guard(async (_e, p) => recepcionCrearHandler(db, p)));
  ipcMain.handle('compras.recepcion:listByOC',    guard(async (_e, ocId) => recepcionListByOCHandler(db, ocId)));
  ipcMain.handle('compras.recepcion:get',         guard(async (_e, recepcionId) => recepcionGetHandler(db, recepcionId)));
}
