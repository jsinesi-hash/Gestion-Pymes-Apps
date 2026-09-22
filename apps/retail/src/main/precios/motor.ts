import { eq, and, isNull } from 'drizzle-orm';
import {
  generateId,
  costoNeto,
  resolverRegla,
  precioConMargen,
  redondearComercial,
  margenRealPct,
  type ReglaPrecio,
} from '@ferreteria/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getOriginId } from '@core/main';
import { getDefaultPresentacionId } from '../ipc/presentacion';
import { resolveProductosAfectados } from '../ipc/lista-precio-valor';
import { validarFila, type Umbrales } from './validacion';
import { recontarBatch } from './publicacion';

type Db = BetterSQLite3Database<typeof schema>;

export type PriceBatchOrigen =
  | 'PROVIDER_COST_UPDATE' | 'MARGIN_UPDATE' | 'SUPPLIER_CHANGE' | 'PRODUCT_CREATED'
  | 'PROMOTION_CREATED' | 'MANUAL_RECALCULATION' | 'ROLLBACK';

export type CrearBatchParams = {
  lista_precio_id: string;
  origen: PriceBatchOrigen;
  alcance: 'catalogo' | 'rubro' | 'marca' | 'proveedor';
  alcance_id?: string;
  proveedor_id?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  excluir_manuales_dias?: number;
};

function leerParamNumero(db: Db, clave: string, def: number): number {
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  const n = row ? Number(row.valor) : NaN;
  return Number.isFinite(n) ? n : def;
}

function leerUmbrales(db: Db): Umbrales {
  return {
    variacionMaximaPct: leerParamNumero(db, 'precios.variacion_maxima_pct', 30),
    margenMinimoPct: leerParamNumero(db, 'precios.margen_minimo_pct', 0),
  };
}

type DetalleCalculado = {
  producto_id: string;
  presentacion_id: string | null;
  costo_neto_centavos: number | null;
  precio_anterior_centavos: number | null;
  precio_propuesto_centavos: number;
  margen_anterior_pct: number | null;
  margen_nuevo_pct: number | null;
  regla_precio_id: string | null;
  variacion_pct: number | null;
  estado_validacion: 'ok' | 'advertencia' | 'error' | 'excluida';
  motivo_validacion: string | null;
};

/** Reglas activas de la lista, en el shape que espera shared/resolverRegla. */
function cargarReglas(db: Db, listaId: string): ReglaPrecio[] {
  return db.select().from(schema.regla_precio)
    .where(and(
      eq(schema.regla_precio.lista_precio_id, listaId),
      eq(schema.regla_precio.activo, true),
    ))
    .all()
    .map(r => ({
      id: r.id,
      tipo: r.tipo as ReglaPrecio['tipo'],
      objetivo_id: r.objetivo_id,
      margen_pct: r.margen_pct,
      margen_min_pct: r.margen_min_pct,
      margen_max_pct: r.margen_max_pct,
      redondeo_modo: r.redondeo_modo as ReglaPrecio['redondeo_modo'],
      redondeo_valor: r.redondeo_valor,
      prioridad: r.prioridad,
    }));
}

type CrearBatchInternoParams = {
  lista_precio_id: string;
  producto_ids: string[];
  origen: PriceBatchOrigen;
  proveedor_id?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
};

/** Núcleo compartido: inserta el lote (padre primero, por la FK) + su detalle calculado. */
function crearBatchInterno(db: Db, params: CrearBatchInternoParams, userId: string): { id: string; estado: string } {
  const reglas = cargarReglas(db, params.lista_precio_id);
  const umbrales = leerUmbrales(db);
  const now = new Date();
  const batchId = generateId();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    const txDb = tx as Db;

    // El padre primero (FK price_batch_detalle.price_batch_id).
    tx.insert(schema.price_batch).values({
      id: batchId,
      lista_precio_id: params.lista_precio_id,
      proveedor_id: params.proveedor_id ?? null,
      origen: params.origen,
      referencia_tipo: params.referencia_tipo ?? null,
      referencia_id: params.referencia_id ?? null,
      estado: 'borrador',
      batch_revertido_id: null,
      productos_ok: 0, advertencias: 0, errores: 0, excluidas: 0,
      impacto_incremento_centavos: 0,
      usuario_creacion_id: userId,
      usuario_aprobador_id: null,
      fecha_creacion: now,
      fecha_aprobacion: null,
      fecha_publicacion: null,
      observaciones: null,
      ...sync,
    }).run();

    let ok = 0, adv = 0, err = 0, impacto = 0;
    for (const productoId of params.producto_ids) {
      const d = calcularFilaConLista(txDb, productoId, params.lista_precio_id, reglas, umbrales);
      if (d.estado_validacion === 'ok') ok++;
      else if (d.estado_validacion === 'advertencia') adv++;
      else if (d.estado_validacion === 'error') err++;
      if (d.estado_validacion !== 'error') {
        impacto += d.precio_propuesto_centavos - (d.precio_anterior_centavos ?? d.precio_propuesto_centavos);
      }
      tx.insert(schema.price_batch_detalle).values({ id: generateId(), price_batch_id: batchId, ...d, ...sync }).run();
    }

    const estado = err > 0 ? 'validacion_fallida' : 'validado';
    tx.update(schema.price_batch).set({
      estado, productos_ok: ok, advertencias: adv, errores: err,
      impacto_incremento_centavos: impacto, updated_at: now,
    }).where(eq(schema.price_batch.id, batchId)).run();

    return { id: batchId, estado };
  });
}

/**
 * Calcula y persiste un lote en 'borrador'/'validado'/'validacion_fallida' (según la
 * validación). NO publica nada. Devuelve el id del lote.
 */
export function crearBatch(db: Db, params: CrearBatchParams, userId: string): { id: string; estado: string } {
  const productos = resolveProductosAfectados(db, {
    lista_precio_id: params.lista_precio_id,
    porcentaje: 0,
    base_calculo: 'precio_lista',
    alcance: params.alcance,
    alcance_id: params.alcance_id,
    excluir_manuales_dias: params.excluir_manuales_dias,
  });
  return crearBatchInterno(db, {
    lista_precio_id: params.lista_precio_id,
    producto_ids: productos.map(p => p.id),
    origen: params.origen,
    proveedor_id: params.proveedor_id ?? null,
    referencia_tipo: params.referencia_tipo ?? null,
    referencia_id: params.referencia_id ?? null,
  }, userId);
}

/**
 * ADR-049 §7 — cierre del circuito de costo. Ante un evento de costo (importación, cambio
 * de preferido, recepción, edición de defaults del proveedor) genera un batch en
 * **borrador** por cada lista activa en modo `margen_costo`, acotado a los productos
 * afectados — nunca publica. Con todas las listas en `pct_sobre_lista` (default), no
 * genera nada: el comportamiento actual no cambia.
 */
export function crearBatchesPorEventoDeCosto(
  db: Db,
  params: {
    producto_ids: string[];
    origen: PriceBatchOrigen;
    proveedor_id?: string | null;
    referencia_tipo?: string | null;
    referencia_id?: string | null;
  },
  userId: string,
): { id: string; lista_precio_id: string; estado: string }[] {
  if (params.producto_ids.length === 0) return [];
  const listasMargenCosto = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio)
    .where(and(
      eq(schema.lista_precio.activo, true),
      eq(schema.lista_precio.modo_calculo, 'margen_costo'),
    ))
    .all();

  return listasMargenCosto.map((lista) => {
    const r = crearBatchInterno(db, {
      lista_precio_id: lista.id,
      producto_ids: params.producto_ids,
      origen: params.origen,
      proveedor_id: params.proveedor_id ?? null,
      referencia_tipo: params.referencia_tipo ?? null,
      referencia_id: params.referencia_id ?? null,
    }, userId);
    return { id: r.id, lista_precio_id: lista.id, estado: r.estado };
  });
}

/**
 * ADR-070 — Re-procesa un lote existente contra el estado ACTUAL de costos/proveedores/reglas.
 * Solo sobre lotes `validado`/`validacion_fallida`. Reejecuta el cálculo por cada fila NO excluida
 * (las excluidas son decisión manual del usuario y se respetan) y recomputa contadores/estado.
 */
export function revalidarBatch(db: Db, batchId: string): { id: string; estado: string } {
  const batch = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, batchId)).get();
  if (!batch) throw new Error('NOT_FOUND');
  if (batch.estado !== 'validado' && batch.estado !== 'validacion_fallida') {
    throw new Error('BATCH_NO_REVALIDABLE');
  }
  const reglas = cargarReglas(db, batch.lista_precio_id);
  const umbrales = leerUmbrales(db);
  const now = new Date();

  return db.transaction((tx) => {
    const txDb = tx as Db;
    const filas = txDb.select().from(schema.price_batch_detalle)
      .where(eq(schema.price_batch_detalle.price_batch_id, batchId)).all();
    for (const fila of filas) {
      if (fila.estado_validacion === 'excluida') continue;
      const d = calcularFilaConLista(txDb, fila.producto_id, batch.lista_precio_id, reglas, umbrales);
      tx.update(schema.price_batch_detalle).set({
        presentacion_id: d.presentacion_id,
        costo_neto_centavos: d.costo_neto_centavos,
        precio_anterior_centavos: d.precio_anterior_centavos,
        precio_propuesto_centavos: d.precio_propuesto_centavos,
        margen_anterior_pct: d.margen_anterior_pct,
        margen_nuevo_pct: d.margen_nuevo_pct,
        regla_precio_id: d.regla_precio_id,
        variacion_pct: d.variacion_pct,
        estado_validacion: d.estado_validacion,
        motivo_validacion: d.motivo_validacion,
        updated_at: now,
      }).where(eq(schema.price_batch_detalle.id, fila.id)).run();
    }
    recontarBatch(txDb, batchId);
    const updated = txDb.select().from(schema.price_batch).where(eq(schema.price_batch.id, batchId)).get()!;
    return { id: batchId, estado: updated.estado };
  });
}

/** Costo neto del proveedor preferido de un producto, o null si no tiene uno. */
export function resolverCostoNetoProducto(db: Db, productoId: string): number | null {
  const pp = db.select().from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, productoId),
      eq(schema.producto_proveedor.preferido, true),
      isNull(schema.producto_proveedor.deleted_at),
    )).get();
  if (!pp) return null;
  const prov = db.select().from(schema.proveedor).where(eq(schema.proveedor.id, pp.proveedor_id)).get();
  if (!prov) return null;
  return costoNeto(
    pp.costo_centavos,
    {
      bonificacionPct: pp.bonificacion_pct,
      costoFinancieroPct: pp.costo_financiero_pct,
      fletePct: pp.flete_pct,
      fleteCentavos: pp.flete_centavos,
      otrosCostosCentavos: pp.otros_costos_centavos,
    },
    {
      bonificacionPctDefault: prov.bonificacion_pct_default,
      costoFinancieroPctDefault: prov.costo_financiero_pct_default,
      fletePctDefault: prov.flete_pct_default,
    },
  ).netoCentavos;
}

// calcularFila necesita el lista_precio_id para leer el precio vigente; se pasa explícito.
function calcularFilaConLista(
  db: Db, productoId: string, listaId: string, reglas: ReglaPrecio[], umbrales: Umbrales,
): DetalleCalculado {
  const prod = db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get();
  const pp = db.select().from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, productoId),
      eq(schema.producto_proveedor.preferido, true),
      isNull(schema.producto_proveedor.deleted_at),
    )).get();
  const prov = pp ? db.select().from(schema.proveedor).where(eq(schema.proveedor.id, pp.proveedor_id)).get() : null;
  const vigente = db.select().from(schema.lista_precio_valor)
    .where(and(
      eq(schema.lista_precio_valor.lista_precio_id, listaId),
      eq(schema.lista_precio_valor.producto_id, productoId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    )).get();

  const neto = pp && prov
    ? costoNeto(
        pp.costo_centavos,
        {
          bonificacionPct: pp.bonificacion_pct,
          costoFinancieroPct: pp.costo_financiero_pct,
          fletePct: pp.flete_pct,
          fleteCentavos: pp.flete_centavos,
          otrosCostosCentavos: pp.otros_costos_centavos,
        },
        {
          bonificacionPctDefault: prov.bonificacion_pct_default,
          costoFinancieroPctDefault: prov.costo_financiero_pct_default,
          fletePctDefault: prov.flete_pct_default,
        },
      ).netoCentavos
    : null;

  const regla = resolverRegla(reglas, {
    producto_id: productoId,
    marca_id: prod?.marca_id ?? null,
    categoria_id: prod?.categoria_id ?? null,
    proveedor_id: pp?.proveedor_id ?? null,
  });

  const precioAnterior = vigente?.precio_centavos ?? null;
  let precioPropuesto = precioAnterior ?? 0;
  if (regla && neto != null) {
    precioPropuesto = redondearComercial(precioConMargen(neto, regla.margen_pct), regla.redondeo_modo, regla.redondeo_valor);
  }

  const margenNuevo = neto != null && precioPropuesto > 0 ? margenRealPct(precioPropuesto, neto) : null;
  const margenAnterior = neto != null && precioAnterior != null && precioAnterior > 0 ? margenRealPct(precioAnterior, neto) : null;
  const variacion = precioAnterior != null && precioAnterior > 0 ? (precioPropuesto - precioAnterior) / precioAnterior * 100 : null;

  let estado: DetalleCalculado['estado_validacion'];
  let motivo: string | null;
  if (!regla) {
    estado = 'error'; motivo = 'Sin regla de margen aplicable';
  } else {
    const r = validarFila({
      costoNetoCentavos: neto,
      precioPropuestoCentavos: precioPropuesto,
      precioAnteriorCentavos: precioAnterior,
      tienePreferido: !!pp,
      proveedorActivo: prov?.activo ?? false,
      productoActivo: prod?.activo ?? false,
      margenMinPct: regla.margen_min_pct,
      margenMaxPct: regla.margen_max_pct,
    }, umbrales);
    estado = r.estado; motivo = r.motivo;
  }

  return {
    producto_id: productoId,
    presentacion_id: getDefaultPresentacionId(db, productoId),
    costo_neto_centavos: neto,
    precio_anterior_centavos: precioAnterior,
    precio_propuesto_centavos: precioPropuesto,
    margen_anterior_pct: margenAnterior,
    margen_nuevo_pct: margenNuevo,
    regla_precio_id: regla?.id ?? null,
    variacion_pct: variacion,
    estado_validacion: estado,
    motivo_validacion: motivo,
  };
}
