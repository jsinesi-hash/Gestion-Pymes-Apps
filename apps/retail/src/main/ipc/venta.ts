import { eq, and, asc, gte, lte, inArray } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, inicioDelDia, finDelDia, nombreCompletoCliente, verificarTotalesVenta } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { verificarSupervisor, optId, arr, num, centavos, oneOf, id as vId, confirmarVenta, anularVenta, ventaListByCajaHandler, type AplicarLineasCtx, type RevertirLineasCtx, type VentaPagoPayload, requireSession } from '@core/main';
export type { VentaPagoPayload } from '@core/main';
export { ventaListByCajaHandler };
import { marcarPresupuestoConvertido } from './presupuesto';
import { getPrecioEnListaHandler, resolverListaEfectiva } from './lista-precio-valor';
import { resolverCostoNetoProducto } from '../precios/motor';

type Db = BetterSQLite3Database<typeof schema>;

export type LineaPayload = {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  alicuota_iva: number;
  subtotal: number;
  // ADR-040: snapshot at sale time; null for sales before multi-presentación
  presentacion_id?: string | null;
  factor_a_stock_aplicado?: number | null;
};

export type VentaConfirmarPayload = {
  caja_id: string;
  cliente_id: string;
  lineas: LineaPayload[];
  descuento_global: number;
  subtotal: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
  pagos: VentaPagoPayload[];
  vuelto_centavos?: number | null;
  venta_en_espera_id?: string;
  // ADR-046: si la venta proviene de convertir un presupuesto, su id. Al confirmar se
  // marca el presupuesto como 'convertido' en la misma transaccion.
  presupuesto_id?: string | null;
  supervisor_credenciales?: { nombre_usuario: string; password: string };
};

export type VentaAnularPayload = {
  venta_id: string;
  motivo: string;
  supervisor_credenciales: { nombre_usuario: string; password: string };
};

// Tolerancia para comparar stock fraccionario (productos que permiten fracción) sin que el error
// de coma flotante rechace una venta que consume exactamente el stock.
const EPS_STOCK = 1e-9;

/**
 * Revisión 2026-10-20 (P0): `factor_a_stock_aplicado` lo manda el renderer y define cuánto stock
 * se descuenta (cantidad × factor); con factor 0 se vendía sin descontar. Acá se verifica que sea
 * finito y > 0, y que coincida con la presentación de la línea (o sea 1 si no trae presentación).
 * Devuelve el factor validado.
 */
function validarFactorDeLinea(db: Db, linea: LineaPayload): number {
  const factor = linea.factor_a_stock_aplicado ?? 1.0;
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('FACTOR_INVALIDO');

  if (linea.presentacion_id) {
    const pp = db.select().from(schema.producto_presentacion)
      .where(and(
        eq(schema.producto_presentacion.id, linea.presentacion_id),
        eq(schema.producto_presentacion.producto_id, linea.producto_id),
        eq(schema.producto_presentacion.activo, true),
      )).get();
    if (!pp) throw new Error('PRESENTACION_INVALIDA');
    if (Math.abs(pp.factor_a_stock - factor) > EPS_STOCK) throw new Error('FACTOR_INVALIDO');
  } else if (Math.abs(factor - 1) > EPS_STOCK) {
    throw new Error('FACTOR_INVALIDO');
  }
  return factor;
}

/**
 * Revisión 2026-10-20 (P1): los totales los calcula el renderer; el main rehace la cuenta en
 * centavos (misma fórmula del POS) y rechaza lo inconsistente. Lo usan la confirmación (antes de
 * tocar stock o caja) y el pausado de una venta en espera: una venta en espera no impacta stock ni
 * caja, pero se lista con su total y no puede quedar guardada con uno falso.
 */
export function verificarTotalesDePayload(
  payload: Pick<VentaConfirmarPayload, 'lineas' | 'descuento_global' | 'subtotal' | 'importe_iva' | 'total' | 'ajuste_redondeo'>,
): void {
  verificarTotalesVenta({
    lineas: payload.lineas.map((l) => ({
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      descuento_linea: l.descuento_linea,
      alicuota_iva: l.alicuota_iva,
      subtotal: l.subtotal,
    })),
    descuento_global: payload.descuento_global,
    subtotal: payload.subtotal,
    importe_iva: payload.importe_iva,
    total: payload.total,
    ajuste_redondeo: payload.ajuste_redondeo,
  });
}

function validarLineasPrevio(db: Db, payload: VentaConfirmarPayload): void {
  verificarTotalesDePayload(payload);

  // ADR-049 §9 — lista efectiva del cliente (cliente.lista_precio_id → predeterminada),
  // para re-resolver el precio de cada línea contra el servidor.
  const listaPredeterminadaRow = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio).where(eq(schema.lista_precio.predeterminada, true)).get();
  const listaEfectivaId = listaPredeterminadaRow
    ? resolverListaEfectiva(db, payload.cliente_id, listaPredeterminadaRow.id)
    : null;

  let precioDesactualizado = false;
  // Revisión 2026-10-20 (P0): el stock se compara por producto, no por línea. Dos líneas del
  // mismo producto (p. ej. distinta presentación) pasaban cada una sola y dejaban stock negativo.
  const stockPedido = new Map<string, number>();

  for (const linea of payload.lineas) {
    const prod = db.select().from(schema.producto)
      .where(eq(schema.producto.id, linea.producto_id)).get();
    if (!prod?.activo) throw new Error('PRODUCTO_INACTIVO');
    const factor = validarFactorDeLinea(db, linea);
    const cantidadStock = linea.cantidad * factor;
    const pedido = (stockPedido.get(linea.producto_id) ?? 0) + cantidadStock;
    stockPedido.set(linea.producto_id, pedido);
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, linea.producto_id)).get();
    if (!ex || ex.stock_fisico + EPS_STOCK < pedido) throw new Error('STOCK_INSUFICIENTE');

    // ADR-049 §9 — el servidor re-resuelve el precio de lista y lo compara contra el
    // recibido (mismo factor de presentación y descuento de línea que aplicó el cliente).
    if (listaEfectivaId) {
      const resuelto = getPrecioEnListaHandler(db, { productoId: linea.producto_id, listaId: listaEfectivaId });
      const listaCentavos = Math.round(resuelto.precio_centavos * factor);
      const esperadoCentavos = Math.round(listaCentavos * (1 - linea.descuento_linea / 100));
      const recibidoCentavos = Math.round(linea.precio_unitario * 100);
      if (esperadoCentavos !== recibidoCentavos) precioDesactualizado = true;
    }
  }

  if (precioDesactualizado) {
    if (!payload.supervisor_credenciales) throw new Error('PRECIO_DESACTUALIZADO');
    verificarSupervisor(db, payload.supervisor_credenciales);
  }
}

type Tx = Parameters<typeof marcarPresupuestoConvertido>[0];

function aplicarLineasRetail(tx: Tx, payload: VentaConfirmarPayload, ctx: AplicarLineasCtx): void {
  const { ventaId, now, sync, userId, esRetoma } = ctx;

  // ADR-046 §4: marca el presupuesto como convertido en la MISMA transaccion.
  // Condicionado a estado IN ('emitido','vencido'): si ya no es convertible, toda
  // la venta hace rollback.
  if (payload.presupuesto_id) {
    marcarPresupuestoConvertido(tx, payload.presupuesto_id, ventaId);
  }

  if (esRetoma) {
    tx.delete(schema.venta_detalle)
      .where(eq(schema.venta_detalle.venta_id, ventaId)).run();
  }

  for (const linea of payload.lineas) {
    const factorAplicado = linea.factor_a_stock_aplicado ?? 1.0;
    const cantidadStockLinea = linea.cantidad * factorAplicado;

    tx.insert(schema.venta_detalle).values({
      id: generateId(),
      venta_id: ventaId,
      producto_id: linea.producto_id,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      descuento_linea: linea.descuento_linea,
      alicuota_iva: linea.alicuota_iva,
      subtotal: linea.subtotal,
      presentacion_id: linea.presentacion_id ?? null,
      factor_a_stock_aplicado: factorAplicado,
      ...sync,
    }).run();

    const ex = tx.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, linea.producto_id)).get()!;
    const stockResultante = ex.stock_fisico - cantidadStockLinea;
    // Red de seguridad dentro de la transacción: la validación previa corre fuera de ella.
    if (stockResultante < -EPS_STOCK) throw new Error('STOCK_INSUFICIENTE');

    // ADR-049 §9 — costo neto del momento (habilita margen real por venta en el
    // Dashboard); null si el producto no tiene proveedor preferido con costo.
    const costoNetoCentavos = resolverCostoNetoProducto(tx as Db, linea.producto_id);

    tx.insert(schema.movimiento_stock).values({
      id: generateId(),
      producto_id: linea.producto_id,
      tipo: 'salida',
      motivo: 'venta',
      cantidad: cantidadStockLinea,
      stock_resultante: stockResultante,
      costo_unitario: costoNetoCentavos != null ? costoNetoCentavos / 100 : null,
      referencia_tipo: 'venta',
      referencia_id: ventaId,
      usuario_id: userId,
      fecha: now,
      ...sync,
    }).run();

    tx.update(schema.existencias).set({
      stock_fisico: stockResultante,
      ultima_fecha_movimiento: now,
      version: ex.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.existencias.producto_id, linea.producto_id)).run();
  }
}

export function ventaConfirmarHandler(db: Db, rawPayload: unknown) {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  // ADR-082 (SEC-2): validación de forma/tipo en el borde, ANTES de la lógica de negocio.
  // Solo controla la forma del payload (no re-implementa reglas: PAGOS_REQUERIDOS,
  // STOCK_INSUFICIENTE, MEDIO_PAGO_DUPLICADO, etc. siguen siendo del core/hooks). Se corre
  // por su efecto de throw; el cuerpo sigue leyendo el payload original completo.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  optId(p['cliente_id'], 'cliente_id');
  arr(p['lineas'], 'lineas', (l, i) => {
    const li = (l ?? {}) as Record<string, unknown>;
    return {
      producto_id: vId(li['producto_id'], `lineas.${i}.producto_id`),
      cantidad: num(li['cantidad'], `lineas.${i}.cantidad`, { min: 0 }),
    };
  });
  arr(p['pagos'], 'pagos', (pg, i) => {
    const pj = (pg ?? {}) as Record<string, unknown>;
    return {
      medio_pago: oneOf(pj['medio_pago'], `pagos.${i}.medio_pago`,
        ['efectivo', 'tarjeta', 'cuenta_corriente', 'transferencia', 'cheque'] as const),
      monto_centavos: centavos(pj['monto_centavos'], `pagos.${i}.monto_centavos`),
    };
  });
  const payload = rawPayload as VentaConfirmarPayload;

  const { venta, comprobante } = confirmarVenta(db, {
    caja_id: payload.caja_id,
    cliente_id: payload.cliente_id,
    subtotal: payload.subtotal,
    descuento_global: payload.descuento_global,
    importe_iva: payload.importe_iva,
    total: payload.total,
    ajuste_redondeo: payload.ajuste_redondeo,
    pagos: payload.pagos,
    ...(payload.venta_en_espera_id !== undefined && { venta_en_espera_id: payload.venta_en_espera_id }),
    ...(payload.presupuesto_id !== undefined && { presupuesto_id: payload.presupuesto_id }),
    ...(payload.supervisor_credenciales !== undefined && { supervisor_credenciales: payload.supervisor_credenciales }),
  }, {
    validarPrevio: () => validarLineasPrevio(db, payload),
    aplicarLineas: (tx, ctx) => aplicarLineasRetail(tx as unknown as Tx, payload, ctx),
  });

  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, venta.id)).all();
  return { venta, detalles, comprobante };
}

function revertirLineasRetail(tx: Tx, ctx: RevertirLineasCtx): void {
  const { venta, now, sync, userId } = ctx;
  const detalles = tx.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, venta.id)).all();

  for (const det of detalles) {
    const ex = tx.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, det.producto_id)).get()!;
    const factorDet = det.factor_a_stock_aplicado ?? 1.0;
    const cantidadStockDet = det.cantidad * factorDet;
    const stockResultante = ex.stock_fisico + cantidadStockDet;

    tx.insert(schema.movimiento_stock).values({
      id: generateId(),
      producto_id: det.producto_id,
      tipo: 'entrada',
      motivo: 'devolucion',
      cantidad: cantidadStockDet,
      stock_resultante: stockResultante,
      costo_unitario: null,
      referencia_tipo: 'anulacion_venta',
      referencia_id: venta.id,
      usuario_id: userId,
      fecha: now,
      ...sync,
    }).run();

    tx.update(schema.existencias).set({
      stock_fisico: stockResultante,
      ultima_fecha_movimiento: now,
      version: ex.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.existencias.producto_id, det.producto_id)).run();
  }
}

export function ventaAnularHandler(db: Db, payload: VentaAnularPayload) {
  return anularVenta(db, {
    venta_id: payload.venta_id,
    motivo: payload.motivo,
    supervisor_credenciales: payload.supervisor_credenciales,
  }, {
    revertirLineas: (tx, ctx) => revertirLineasRetail(tx as unknown as Tx, ctx),
  });
}

export function ventaGetHandler(db: Db, payload: { id: string }) {
  const venta = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.id)).get();
  if (!venta) return null;
  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, payload.id)).all();
  const comprobante = venta.comprobante_id
    ? db.select().from(schema.comprobante)
        .where(eq(schema.comprobante.id, venta.comprobante_id)).get() ?? null
    : null;
  const cliente = venta.cliente_id
    ? (() => {
        const c = db.select({ nombre: schema.cliente.nombre, apellido: schema.cliente.apellido })
          .from(schema.cliente)
          .where(eq(schema.cliente.id, venta.cliente_id)).get();
        return c ? { nombre_completo: nombreCompletoCliente(c) } : null;
      })()
    : null;
  return { venta, detalles, comprobante, cliente };
}

export type VentaExportFiltros = {
  desde?: Date | string;
  hasta?: Date | string;
  estado?: 'confirmada' | 'anulada';
};

export function ventaQueryAll(db: Db, filtros: VentaExportFiltros = {}) {
  const { desde, hasta, estado } = filtros;
  // Días de calendario, inclusivos, en hora local (ver @ferreteria/shared/fecha).
  const desdeDate = desde ? inicioDelDia(desde) : undefined;
  const hastaDate = hasta ? finDelDia(hasta) : undefined;

  const where = and(
    inArray(schema.venta.estado, ['confirmada', 'anulada']),
    desdeDate ? gte(schema.venta.fecha, desdeDate) : undefined,
    hastaDate ? lte(schema.venta.fecha, hastaDate) : undefined,
    estado ? eq(schema.venta.estado, estado) : undefined,
  );

  return db.select({
    numero_interno:  schema.venta.numero_interno,
    fecha:           schema.venta.fecha,
    cliente_nombre_raw: schema.cliente.nombre,
    cliente_apellido_raw: schema.cliente.apellido,
    cajero_nombre:   schema.usuario.nombre_completo,
    forma_pago:      schema.venta.forma_pago,
    total:           schema.venta.total,
    estado:          schema.venta.estado,
  })
    .from(schema.venta)
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.venta.cliente_id))
    .leftJoin(schema.usuario, eq(schema.usuario.id, schema.venta.usuario_id))
    .where(where)
    .orderBy(asc(schema.venta.fecha))
    .all()
    .map(({ cliente_nombre_raw, cliente_apellido_raw, ...r }) => ({
      ...r,
      cliente_nombre: cliente_nombre_raw != null
        ? nombreCompletoCliente({ nombre: cliente_nombre_raw, apellido: cliente_apellido_raw })
        : null,
    }));
}

export function ventaDetalladoQueryAll(db: Db, filtros: VentaExportFiltros = {}) {
  const { desde, hasta, estado } = filtros;
  // Días de calendario, inclusivos, en hora local (ver @ferreteria/shared/fecha).
  const desdeDate = desde ? inicioDelDia(desde) : undefined;
  const hastaDate = hasta ? finDelDia(hasta) : undefined;

  const where = and(
    inArray(schema.venta.estado, ['confirmada', 'anulada']),
    desdeDate ? gte(schema.venta.fecha, desdeDate) : undefined,
    hastaDate ? lte(schema.venta.fecha, hastaDate) : undefined,
    estado ? eq(schema.venta.estado, estado) : undefined,
  );

  return db.select({
    numero_interno:  schema.venta.numero_interno,
    fecha:           schema.venta.fecha,
    sku:             schema.producto.sku,
    descripcion:     schema.venta_detalle.descripcion,
    cantidad:        schema.venta_detalle.cantidad,
    precio_unitario: schema.venta_detalle.precio_unitario,
    subtotal:        schema.venta_detalle.subtotal,
  })
    .from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta.id, schema.venta_detalle.venta_id))
    .leftJoin(schema.producto, eq(schema.producto.id, schema.venta_detalle.producto_id))
    .where(where)
    .orderBy(asc(schema.venta.fecha))
    .all();
}

export function registerVentaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('venta:confirmar',  async (_e, p) => ventaConfirmarHandler(db, p));
  ipcMain.handle('venta:anular',     async (_e, p) => ventaAnularHandler(db, p));
  ipcMain.handle('venta:get',        async (_e, p) => ventaGetHandler(db, p));
}
