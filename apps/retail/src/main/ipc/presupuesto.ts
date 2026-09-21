import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, and, ne, lt, inArray, desc } from 'drizzle-orm';
import { app, dialog, BrowserWindow, type IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, resolverPrecio, nombreCompletoCliente, type LineaPrecioInput } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { getPrecioEnListaHandler } from './lista-precio-valor';
import { renderPresupuestoHtml } from '../print/presupuesto-template';
import { id, optId, num, optStr, arr } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Proyeccion PR- + 7 digitos cero-padded. Secuencial estilo SKU SIN digito Luhn (ADR-046 §2). */
export function formatNumeroPresupuesto(secuencial: number): string {
  return `PR-${String(secuencial).padStart(7, '0')}`;
}

/**
 * Lee e incrementa presupuesto_proximo_secuencial dentro de la transaccion de emision.
 * Single-node; multinodo diferido a R4. Mismo patron que nextNumeroRemitoAtomico.
 * El contador se consume recien despues de validar, para no dejar huecos.
 */
export function nextNumeroPresupuestoAtomico(tx: Tx): { numero: string; secuencial: number } {
  const row = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'presupuesto_proximo_secuencial')).get();
  if (!row) throw new Error('presupuesto_proximo_secuencial no encontrado en parametros_sistema');
  const secuencial = Number.parseInt(row.valor, 10);
  tx.update(schema.parametros_sistema)
    .set({ valor: String(secuencial + 1), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'presupuesto_proximo_secuencial')).run();
  return { numero: formatNumeroPresupuesto(secuencial), secuencial };
}

export function getValidezDiasDefault(db: Db | Tx): number {
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'presupuesto_validez_dias_default')).get();
  const n = row ? Number.parseInt(row.valor, 10) : 15;
  return Number.isFinite(n) && n > 0 ? n : 15;
}

// ── Motor de calculo (reutiliza el mismo resolver que el POS) ──────────────────

export type LineaInput = {
  producto_id: string;
  cantidad: number;
  descuento_linea_pct?: number;
  presentacion_id?: string | null;
};

export type LineaComputada = {
  producto_id: string;
  presentacion_id: string | null;
  descripcion: string;
  cantidad: number;
  descuento_linea_pct: number;
  alicuota_iva: number;
  factor_a_stock: number;
  precio_unitario_centavos: number;
  subtotal_centavos: number;
};

export type PresupuestoComputado = {
  total_centavos: number;
  lineas: LineaComputada[];
};

/**
 * Resuelve precios EN VIVO con el mismo motor que el POS: getPrecioEnLista
 * (precedencia promocion > vigente > fallback) sobre la lista predeterminada, factor
 * de presentacion (ADR-040), y resolverPrecio() para descuentos de linea + global.
 * NO valida stock: un presupuesto puede cotizar sin existencias (ADR-046 §1/§4).
 */
export function computarPresupuesto(
  db: Db | Tx,
  input: { descuento_global_pct: number; lineas: LineaInput[] },
): PresupuestoComputado {
  const listaPred = db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.predeterminada, true)).get();

  const meta: Omit<LineaComputada, 'precio_unitario_centavos' | 'subtotal_centavos'>[] = [];
  const inputsPrecio: LineaPrecioInput[] = [];

  for (const l of input.lineas) {
    const prod = db.select().from(schema.producto)
      .where(eq(schema.producto.id, l.producto_id)).get();
    if (!prod) throw new Error(`PRODUCTO_NOT_FOUND:${l.producto_id}`);

    // Precio base (ya incluye ajuste de lista); si no hay lista predeterminada,
    // fallback al precio de lista del producto.
    let precioCentavos: number;
    if (listaPred) {
      precioCentavos = getPrecioEnListaHandler(db as Db, {
        productoId: l.producto_id, listaId: listaPred.id,
      }).precio_centavos;
    } else {
      precioCentavos = Math.round(prod.precio_venta_lista * 100);
    }

    // Factor de presentacion (ADR-040): la presentacion elegida o la default.
    let factor = 1;
    let presentacionId = l.presentacion_id ?? null;
    const pp = presentacionId
      ? db.select().from(schema.producto_presentacion)
          .where(eq(schema.producto_presentacion.id, presentacionId)).get()
      : db.select().from(schema.producto_presentacion)
          .where(and(
            eq(schema.producto_presentacion.producto_id, l.producto_id),
            eq(schema.producto_presentacion.es_default, true),
          )).get();
    if (pp) { factor = pp.factor_a_stock ?? 1; presentacionId = pp.id; }

    const alicuota = prod.impuesto_id
      ? (db.select().from(schema.impuesto)
          .where(eq(schema.impuesto.id, prod.impuesto_id)).get()?.alicuota ?? 0)
      : 0;

    meta.push({
      producto_id: l.producto_id,
      presentacion_id: presentacionId,
      descripcion: prod.nombre_corto,
      cantidad: l.cantidad,
      descuento_linea_pct: l.descuento_linea_pct ?? 0,
      alicuota_iva: alicuota,
      factor_a_stock: factor,
    });
    inputsPrecio.push({
      precioListaCentavos: Math.round(precioCentavos * factor),
      ajustePct: 0, // ya incorporado en precioListaCentavos
      descuentoLineaPct: l.descuento_linea_pct ?? 0,
      cantidad: l.cantidad,
    });
  }

  const resultado = resolverPrecio({
    lineas: inputsPrecio,
    descuentoGlobalPct: input.descuento_global_pct,
  });

  const lineas: LineaComputada[] = meta.map((m, i) => ({
    ...m,
    precio_unitario_centavos: resultado.lineas[i].precioUnitarioCentavos,
    subtotal_centavos: resultado.lineas[i].subtotalCentavos,
  }));

  return { total_centavos: resultado.totalCentavos, lineas };
}

// ── ABM Borrador (ADR-046 §1) ──────────────────────────────────────────────────

function syncMeta(now: Date) {
  return { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
}

/** Valida una linea de entrada (crear/editar); shape = LineaInput. */
function validarLinea(x: unknown, i: number): LineaInput {
  const l = (x ?? {}) as Record<string, unknown>;
  const descuentoLineaPct = l['descuento_linea_pct'] == null
    ? undefined
    : num(l['descuento_linea_pct'], `lineas.${i}.descuento_linea_pct`, { min: 0, max: 100 });
  return {
    producto_id: id(l['producto_id'], `lineas.${i}.producto_id`),
    cantidad: num(l['cantidad'], `lineas.${i}.cantidad`, { min: 0 }),
    // exactOptionalPropertyTypes: solo incluir la clave si vino un valor (spread condicional).
    ...(descuentoLineaPct !== undefined ? { descuento_linea_pct: descuentoLineaPct } : {}),
    presentacion_id: optId(l['presentacion_id'], `lineas.${i}.presentacion_id`) ?? null,
  };
}

/**
 * Crea un presupuesto en estado 'borrador'. NO asigna numero ni congela precio: los
 * precios se resuelven en vivo y se recalculan en cada edicion (ADR-046 §1).
 */
export function presupuestoCrearHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_cliente_id = optId(p['cliente_id'], 'cliente_id');
  const v_validez_dias = p['validez_dias'] == null ? undefined : num(p['validez_dias'], 'validez_dias', { min: 0 });
  const v_descuento_global_pct = p['descuento_global_pct'] == null
    ? undefined
    : num(p['descuento_global_pct'], 'descuento_global_pct', { min: 0, max: 100 });
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);
  const v_lineas = arr(p['lineas'], 'lineas', validarLinea);

  const validezDias = v_validez_dias ?? getValidezDiasDefault(db);
  const descGlobal = v_descuento_global_pct ?? 0;
  const now = new Date();
  const sync = syncMeta(now);

  return db.transaction((tx) => {
    const computo = computarPresupuesto(tx, { descuento_global_pct: descGlobal, lineas: v_lineas });
    const presupuestoId = generateId();

    tx.insert(schema.presupuesto).values({
      id: presupuestoId,
      numero_secuencial: null,
      numero: null,
      cliente_id: v_cliente_id ?? null,
      estado: 'borrador',
      fecha_emision: null,
      validez_dias: validezDias,
      fecha_validez: null,
      descuento_global_pct: descGlobal,
      total_centavos: computo.total_centavos,
      usuario_id: session.userId,
      venta_id: null,
      observaciones: v_observaciones ?? null,
      activo: true,
      creado_por_usuario_id: session.userId,
      creado_en: now,
      ...sync,
    }).run();

    insertarLineas(tx, presupuestoId, computo.lineas, now);
    return obtenerInterno(tx, presupuestoId);
  });
}

function insertarLineas(tx: Tx, presupuestoId: string, lineas: LineaComputada[], now: Date) {
  for (const l of lineas) {
    tx.insert(schema.presupuesto_detalle).values({
      id: generateId(),
      presupuesto_id: presupuestoId,
      producto_id: l.producto_id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario_centavos: l.precio_unitario_centavos,
      descuento_linea_pct: l.descuento_linea_pct,
      alicuota_iva: l.alicuota_iva,
      subtotal_centavos: l.subtotal_centavos,
      presentacion_id: l.presentacion_id,
      ...syncMeta(now),
    }).run();
  }
}

/** Edita un borrador: reemplaza cabecera + lineas y recalcula en vivo. Solo estado='borrador'. */
export function presupuestoEditarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const clienteIdRaw = p['cliente_id'];
  const v_cliente_id = optId(clienteIdRaw, 'cliente_id');
  const v_validez_dias = p['validez_dias'] == null ? undefined : num(p['validez_dias'], 'validez_dias', { min: 0 });
  const v_descuento_global_pct = p['descuento_global_pct'] == null
    ? undefined
    : num(p['descuento_global_pct'], 'descuento_global_pct', { min: 0, max: 100 });
  const observacionesRaw = p['observaciones'];
  const v_observaciones = optStr(observacionesRaw, 'observaciones', 1000);
  const v_lineas = arr(p['lineas'], 'lineas', validarLinea);

  const existing = db.select().from(schema.presupuesto)
    .where(eq(schema.presupuesto.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado !== 'borrador') throw new Error(`ESTADO_INVALIDO:${existing.estado}`);

  const now = new Date();
  const descGlobal = v_descuento_global_pct ?? existing.descuento_global_pct;
  const validezDias = v_validez_dias ?? existing.validez_dias;

  return db.transaction((tx) => {
    const computo = computarPresupuesto(tx, { descuento_global_pct: descGlobal, lineas: v_lineas });

    tx.delete(schema.presupuesto_detalle)
      .where(eq(schema.presupuesto_detalle.presupuesto_id, v_id)).run();

    tx.update(schema.presupuesto).set({
      cliente_id: clienteIdRaw === undefined ? existing.cliente_id : (v_cliente_id ?? null),
      validez_dias: validezDias,
      descuento_global_pct: descGlobal,
      total_centavos: computo.total_centavos,
      observaciones: observacionesRaw === undefined ? existing.observaciones : (v_observaciones ?? null),
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.presupuesto.id, v_id)).run();

    insertarLineas(tx, v_id, computo.lineas, now);
    return obtenerInterno(tx, v_id);
  });
}

/** Anulacion: borrador o emitido/vencido pasan a 'anulado' (soft). No convertido. */
export function presupuestoAnularHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');

  const existing = db.select().from(schema.presupuesto)
    .where(eq(schema.presupuesto.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado === 'convertido') throw new Error('ESTADO_INVALIDO:convertido');
  if (existing.estado === 'anulado') throw new Error('ESTADO_INVALIDO:anulado');

  const now = new Date();
  db.update(schema.presupuesto).set({
    estado: 'anulado',
    activo: false,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.presupuesto.id, v_id)).run();

  return db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, v_id)).get()!;
}

// ── Emitir (ADR-046 §2) ─────────────────────────────────────────────────────────

/**
 * Emite un borrador: asigna numero atomico, congela snapshot de precios, setea
 * fecha_emision/fecha_validez y pasa a 'emitido'. validez_dias es editable al emitir
 * (arranca en presupuesto_validez_dias_default). Todo en una transaccion (ADR-046 §2).
 */
export function presupuestoEmitirHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const v_validez_dias = p['validez_dias'] == null ? undefined : num(p['validez_dias'], 'validez_dias', { min: 0 });

  const existing = db.select().from(schema.presupuesto)
    .where(eq(schema.presupuesto.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado !== 'borrador') throw new Error(`ESTADO_INVALIDO:${existing.estado}`);

  const detalles = db.select().from(schema.presupuesto_detalle)
    .where(eq(schema.presupuesto_detalle.presupuesto_id, v_id)).all();
  if (detalles.length === 0) throw new Error('SIN_LINEAS');

  const validezDias = v_validez_dias ?? existing.validez_dias;
  if (!Number.isFinite(validezDias) || validezDias <= 0) throw new Error('VALIDEZ_INVALIDA');

  const now = new Date();
  const fechaValidez = new Date(now.getTime() + validezDias * MS_POR_DIA);

  return db.transaction((tx) => {
    // Re-resuelve precios al momento de emitir y los congela.
    const computo = computarPresupuesto(tx, {
      descuento_global_pct: existing.descuento_global_pct,
      lineas: detalles.map((d) => ({
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        descuento_linea_pct: d.descuento_linea_pct,
        presentacion_id: d.presentacion_id,
      })),
    });

    // Reescribe las lineas con el snapshot congelado.
    tx.delete(schema.presupuesto_detalle)
      .where(eq(schema.presupuesto_detalle.presupuesto_id, v_id)).run();
    insertarLineas(tx, v_id, computo.lineas, now);

    // El contador se consume recien aca, despues de validar SIN_LINEAS.
    const { numero, secuencial } = nextNumeroPresupuestoAtomico(tx);

    tx.update(schema.presupuesto).set({
      numero,
      numero_secuencial: secuencial,
      estado: 'emitido',
      fecha_emision: now,
      validez_dias: validezDias,
      fecha_validez: fechaValidez,
      total_centavos: computo.total_centavos,
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.presupuesto.id, v_id)).run();

    return obtenerInterno(tx, v_id);
  });
}

// ── Vencimiento automatico (ADR-046 §3) ──────────────────────────────────────────

/**
 * Job diario: marca 'emitido' -> 'vencido' cuando fecha_validez < ahora. Solo señaliza.
 * Update condicionado a estado='emitido' (compare-and-swap) para no pisar un presupuesto
 * que se este convirtiendo en simultaneo. Devuelve la cantidad marcada.
 */
export function presupuestoVencerLoteHandler(db: Db, payload?: { ahora?: Date | number }): { vencidos: number } {
  const ahora = payload?.ahora ? new Date(payload.ahora) : new Date();
  const vencibles = db.select({ id: schema.presupuesto.id }).from(schema.presupuesto)
    .where(and(
      eq(schema.presupuesto.estado, 'emitido'),
      lt(schema.presupuesto.fecha_validez, ahora),
    )).all();

  let vencidos = 0;
  for (const p of vencibles) {
    const res = db.update(schema.presupuesto).set({
      estado: 'vencido',
      sync_state: 'pending',
      updated_at: new Date(),
    }).where(and(
      eq(schema.presupuesto.id, p.id),
      eq(schema.presupuesto.estado, 'emitido'), // compare-and-swap
    )).run();
    if (res.changes > 0) vencidos += 1;
  }
  return { vencidos };
}

// ── Convertir a venta (ADR-046 §4) ───────────────────────────────────────────────

export type LineaConversion = {
  producto_id: string;
  presentacion_id: string | null;
  descripcion: string;
  cantidad: number;
  descuento_linea_pct: number;
  alicuota_iva: number;
  factor_a_stock: number;
  precio_unitario_centavos: number;
};

/** Factor de una presentacion (ADR-040); 1 si no hay presentacion asociada. */
function factorDePresentacion(db: Db | Tx, presentacionId: string | null): number {
  if (!presentacionId) return 1;
  const pp = db.select().from(schema.producto_presentacion)
    .where(eq(schema.producto_presentacion.id, presentacionId)).get();
  return pp?.factor_a_stock ?? 1;
}

export type ConversionResult = {
  presupuesto_id: string;
  cliente_id: string | null;
  descuento_global_pct: number;
  vencido: boolean;
  aviso: string | null;
  lineas: LineaConversion[];
};

/**
 * Prepara los datos para precargar el POS desde un presupuesto emitido o vencido
 * (ADR-046 §4). Dentro de validez: precio snapshot congelado. Vencido: reprecia cada
 * linea al valor vigente del dia y devuelve un aviso NO bloqueante. NO impacta nada:
 * stock/caja/fiscal se mueven recien al confirmar la venta.
 */
export function presupuestoPrepararConversionHandler(db: Db, payload: unknown): ConversionResult {
  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const raw = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(raw['id'], 'id');

  const p = db.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, v_id)).get();
  if (!p) throw new Error('NOT_FOUND');
  if (p.estado !== 'emitido' && p.estado !== 'vencido') throw new Error(`ESTADO_INVALIDO:${p.estado}`);

  const detalles = db.select().from(schema.presupuesto_detalle)
    .where(eq(schema.presupuesto_detalle.presupuesto_id, v_id)).all();

  const vencido = p.estado === 'vencido';

  let lineas: LineaConversion[];
  if (vencido) {
    // Reprecia al valor vigente de hoy — no se vende a precio viejo por vencido.
    const computo = computarPresupuesto(db, {
      descuento_global_pct: p.descuento_global_pct,
      lineas: detalles.map((d) => ({
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        descuento_linea_pct: d.descuento_linea_pct,
        presentacion_id: d.presentacion_id,
      })),
    });
    lineas = computo.lineas.map((l) => ({
      producto_id: l.producto_id,
      presentacion_id: l.presentacion_id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      descuento_linea_pct: l.descuento_linea_pct,
      alicuota_iva: l.alicuota_iva,
      factor_a_stock: l.factor_a_stock,
      precio_unitario_centavos: l.precio_unitario_centavos,
    }));
  } else {
    // Dentro de validez: usa el snapshot congelado.
    lineas = detalles.map((d) => ({
      producto_id: d.producto_id,
      presentacion_id: d.presentacion_id,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      descuento_linea_pct: d.descuento_linea_pct,
      alicuota_iva: d.alicuota_iva,
      factor_a_stock: factorDePresentacion(db, d.presentacion_id),
      precio_unitario_centavos: d.precio_unitario_centavos ?? 0,
    }));
  }

  return {
    presupuesto_id: p.id,
    cliente_id: p.cliente_id,
    descuento_global_pct: p.descuento_global_pct,
    vencido,
    aviso: vencido ? 'Presupuesto vencido: precios actualizados al valor de hoy.' : null,
    lineas,
  };
}

/**
 * Marca un presupuesto como convertido dentro de la transaccion de la venta (ADR-046 §4).
 * Update condicionado a estado IN ('emitido','vencido'). Llamar desde venta.ts al confirmar
 * una venta que trae presupuesto_id. Lanza si el presupuesto ya no es convertible.
 */
export function marcarPresupuestoConvertido(tx: Tx, presupuestoId: string, ventaId: string): void {
  const p = tx.select().from(schema.presupuesto).where(eq(schema.presupuesto.id, presupuestoId)).get();
  if (!p) throw new Error('PRESUPUESTO_NOT_FOUND');
  const res = tx.update(schema.presupuesto).set({
    estado: 'convertido',
    venta_id: ventaId,
    version: p.version + 1,
    sync_state: 'pending',
    updated_at: new Date(),
  }).where(and(
    eq(schema.presupuesto.id, presupuestoId),
    inArray(schema.presupuesto.estado, ['emitido', 'vencido']),
  )).run();
  if (res.changes === 0) throw new Error(`PRESUPUESTO_NO_CONVERTIBLE:${p.estado}`);
}

// ── Consultas ────────────────────────────────────────────────────────────────

export type ListarPayload = {
  estado?: 'borrador' | 'emitido' | 'vencido' | 'convertido' | 'anulado';
  cliente_id?: string;
  incluir_inactivos?: boolean;
};

export function presupuestoListarHandler(db: Db, payload: ListarPayload = {}) {
  const filtros = [];
  if (!payload.incluir_inactivos) filtros.push(eq(schema.presupuesto.activo, true));
  if (payload.estado) filtros.push(eq(schema.presupuesto.estado, payload.estado));
  if (payload.cliente_id) filtros.push(eq(schema.presupuesto.cliente_id, payload.cliente_id));

  return db.select({
    id: schema.presupuesto.id,
    numero: schema.presupuesto.numero,
    numero_secuencial: schema.presupuesto.numero_secuencial,
    estado: schema.presupuesto.estado,
    fecha_emision: schema.presupuesto.fecha_emision,
    fecha_validez: schema.presupuesto.fecha_validez,
    validez_dias: schema.presupuesto.validez_dias,
    total_centavos: schema.presupuesto.total_centavos,
    cliente_id: schema.presupuesto.cliente_id,
    cliente_nombre: schema.cliente.nombre,
    cliente_apellido: schema.cliente.apellido,
    venta_id: schema.presupuesto.venta_id,
    creado_en: schema.presupuesto.creado_en,
  })
    .from(schema.presupuesto)
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.presupuesto.cliente_id))
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(desc(schema.presupuesto.creado_en))
    .all()
    .map(({ cliente_nombre, cliente_apellido, ...r }) => ({
      ...r,
      cliente_nombre_completo: cliente_nombre != null
        ? nombreCompletoCliente({ nombre: cliente_nombre, apellido: cliente_apellido })
        : null,
    }));
}

function obtenerInterno(db: Db | Tx, id: string) {
  const cab = db.select({
    presupuesto: schema.presupuesto,
    cliente_nombre: schema.cliente.nombre,
    cliente_apellido: schema.cliente.apellido,
    cliente_documento: schema.cliente.numero_documento,
    cliente_condicion_fiscal: schema.cliente.condicion_fiscal,
    // Venta asociada (solo si estado='convertido'): trazabilidad cotización → venta.
    // El total puede diferir del cotizado si se editó el carrito al vender (ADR-046 §4).
    venta_numero_interno: schema.venta.numero_interno,
    venta_total: schema.venta.total,
  })
    .from(schema.presupuesto)
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.presupuesto.cliente_id))
    .leftJoin(schema.venta, eq(schema.venta.id, schema.presupuesto.venta_id))
    .where(eq(schema.presupuesto.id, id))
    .get();
  if (!cab) throw new Error('NOT_FOUND');

  const lineas = db.select().from(schema.presupuesto_detalle)
    .where(eq(schema.presupuesto_detalle.presupuesto_id, id)).all();

  return {
    ...cab.presupuesto,
    cliente_nombre_completo: cab.cliente_nombre != null
      ? nombreCompletoCliente({ nombre: cab.cliente_nombre, apellido: cab.cliente_apellido })
      : null,
    cliente_documento: cab.cliente_documento,
    cliente_condicion_fiscal: cab.cliente_condicion_fiscal,
    venta_numero_interno: cab.venta_numero_interno,
    venta_total: cab.venta_total,
    lineas,
  };
}

export function presupuestoObtenerHandler(db: Db, payload: { id: string }) {
  return obtenerInterno(db, payload.id);
}

export function presupuestoConfigHandler(db: Db) {
  return { validez_dias_default: getValidezDiasDefault(db) };
}

// ── Export PDF (ADR-046 §5 — reutiliza printToPDF, patron ADR-027) ────────────────

async function generarPdfConWindow(html: string): Promise<{ buffer: Buffer; win: BrowserWindow }> {
  const tmpPath = path.join(os.tmpdir(), `presupuesto-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  try {
    await win.loadFile(tmpPath);
    const buffer = await win.webContents.printToPDF({ printBackground: true });
    fs.unlinkSync(tmpPath);
    return { buffer, win };
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    win.destroy();
    throw e;
  }
}

export function toPresupuestoImprimible(p: ReturnType<typeof obtenerInterno>) {
  return {
    numero: p.numero,
    fecha_emision: p.fecha_emision,
    fecha_validez: p.fecha_validez,
    estado: p.estado,
    descuento_global_pct: p.descuento_global_pct,
    total_centavos: p.total_centavos,
    observaciones: p.observaciones,
    cliente_nombre_completo: p.cliente_nombre_completo,
    cliente_documento: p.cliente_documento,
    cliente_condicion_fiscal: p.cliente_condicion_fiscal,
    lineas: p.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario_centavos: l.precio_unitario_centavos,
      descuento_linea_pct: l.descuento_linea_pct,
      subtotal_centavos: l.subtotal_centavos,
    })),
  };
}

export async function presupuestoImprimirHandler(
  db: Db, payload: { id: string },
): Promise<{ guardado: boolean; ruta?: string }> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const p = obtenerInterno(db, payload.id);
  if (p.estado === 'borrador') throw new Error('PRESUPUESTO_BORRADOR'); // solo emitidos (ADR-046 §5)

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar presupuesto',
    defaultPath: path.join(app.getPath('documents'), `${p.numero}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { guardado: false };

  const { buffer, win } = await generarPdfConWindow(renderPresupuestoHtml(toPresupuestoImprimible(p)));
  win.close();
  fs.writeFileSync(filePath, buffer);
  return { guardado: true, ruta: filePath };
}

// ── Registro IPC ─────────────────────────────────────────────────────────────

export function registerPresupuestoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('presupuesto:crear',              async (_e, p) => presupuestoCrearHandler(db, p));
  ipcMain.handle('presupuesto:editar',             async (_e, p) => presupuestoEditarHandler(db, p));
  ipcMain.handle('presupuesto:listar',             async (_e, p) => presupuestoListarHandler(db, p ?? {}));
  ipcMain.handle('presupuesto:obtener',            async (_e, p) => presupuestoObtenerHandler(db, p));
  ipcMain.handle('presupuesto:anular',             async (_e, p) => presupuestoAnularHandler(db, p));
  ipcMain.handle('presupuesto:emitir',             async (_e, p) => presupuestoEmitirHandler(db, p));
  ipcMain.handle('presupuesto:vencerLote',         async (_e, p) => presupuestoVencerLoteHandler(db, p));
  ipcMain.handle('presupuesto:prepararConversion', async (_e, p) => presupuestoPrepararConversionHandler(db, p));
  ipcMain.handle('presupuesto:config',             async ()    => presupuestoConfigHandler(db));
  ipcMain.handle('presupuesto:imprimir',           async (_e, p) => presupuestoImprimirHandler(db, p));
}
