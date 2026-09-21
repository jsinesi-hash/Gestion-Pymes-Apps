import { eq, and, ne, desc, asc, gte, lte, inArray } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, inicioDelDia, finDelDia, nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { verificarSupervisor } from '../auth/verificarSupervisor';
import { marcarPresupuestoConvertido } from './presupuesto';
import { getPrecioEnListaHandler, resolverListaEfectiva } from './lista-precio-valor';
import { resolverCostoNetoProducto } from '../precios/motor';
import { optId, arr, num, centavos, oneOf, id as vId } from '../validation/core';

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

export type VentaPagoPayload = {
  medio_pago: 'efectivo' | 'tarjeta' | 'cuenta_corriente' | 'transferencia' | 'cheque';
  monto_centavos: number;
  recargo_pct?: number;
  recargo_centavos?: number;
  numero_cheque?: string;
  banco?: string;
  fecha_cheque?: string;
  titular_cheque?: string;
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

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

function nextNumeroInterno(tx: Db, terminal: string): string {
  const clave = `venta_correlativo_${terminal}`;
  const param = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave))
    .get();
  if (!param) throw new Error('CORRELATIVO_NOT_FOUND');
  const correlativo = Number.parseInt(param.valor) + 1;
  tx.update(schema.parametros_sistema)
    .set({ valor: String(correlativo), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, clave))
    .run();
  return `V-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

export function ventaConfirmarHandler(db: Db, rawPayload: unknown) {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  // ADR-082 (SEC-2): validación de forma/tipo en el borde, ANTES de la lógica de negocio.
  // Solo controla la forma del payload (no re-implementa reglas: PAGOS_REQUERIDOS,
  // STOCK_INSUFICIENTE, MEDIO_PAGO_DUPLICADO, etc. siguen siendo del handler). Se corre
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

  const cajaRow = db.select().from(schema.caja)
    .where(and(eq(schema.caja.id, payload.caja_id), eq(schema.caja.estado, 'abierta')))
    .get();
  if (!cajaRow) throw new Error('CAJA_REQUERIDA');

  // Validar que los pagos cubren el total
  if (payload.pagos.length === 0) throw new Error('PAGOS_REQUERIDOS');
  // Un mismo medio no puede aparecer dos veces: se carga en una sola línea por su total.
  const mediosUsados = new Set(payload.pagos.map(p => p.medio_pago));
  if (mediosUsados.size !== payload.pagos.length) throw new Error('MEDIO_PAGO_DUPLICADO');
  const totalCentavos = Math.round(payload.total * 100);
  const sumPagosCentavos = payload.pagos.reduce((acc, p) => acc + p.monto_centavos, 0);
  if (sumPagosCentavos < totalCentavos) throw new Error('SALDO_PENDIENTE');

  // ADR-049 §9 — lista efectiva del cliente (cliente.lista_precio_id → predeterminada),
  // para re-resolver el precio de cada línea contra el servidor.
  const listaPredeterminadaRow = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio).where(eq(schema.lista_precio.predeterminada, true)).get();
  const listaEfectivaId = listaPredeterminadaRow
    ? resolverListaEfectiva(db, payload.cliente_id, listaPredeterminadaRow.id)
    : null;

  let precioDesactualizado = false;

  for (const linea of payload.lineas) {
    const prod = db.select().from(schema.producto)
      .where(eq(schema.producto.id, linea.producto_id)).get();
    if (!prod?.activo) throw new Error('PRODUCTO_INACTIVO');
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, linea.producto_id)).get();
    const cantidadStock = linea.cantidad * (linea.factor_a_stock_aplicado ?? 1.0);
    if (!ex || ex.stock_fisico < cantidadStock) throw new Error('STOCK_INSUFICIENTE');

    // ADR-049 §9 — el servidor re-resuelve el precio de lista y lo compara contra el
    // recibido (mismo factor de presentación y descuento de línea que aplicó el cliente).
    if (listaEfectivaId) {
      const resuelto = getPrecioEnListaHandler(db, { productoId: linea.producto_id, listaId: listaEfectivaId });
      const factor = linea.factor_a_stock_aplicado ?? 1.0;
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

  // Validar CCC: límite de crédito
  const pagosCcc = payload.pagos.filter(p => p.medio_pago === 'cuenta_corriente');
  if (pagosCcc.length > 0) {
    const montoCccTotal = pagosCcc.reduce((acc, p) => acc + p.monto_centavos, 0);
    const cuentaRow = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, payload.cliente_id))
      .get();
    if (!cuentaRow || !cuentaRow.activo) throw new Error('CCC_NO_DISPONIBLE');
    if (cuentaRow.limite_credito_centavos > 0 &&
        cuentaRow.saldo_centavos + montoCccTotal > cuentaRow.limite_credito_centavos) {
      if (!payload.supervisor_credenciales) throw new Error('LIMITE_CREDITO_EXCEDIDO');
      verificarSupervisor(db, payload.supervisor_credenciales);
    }
  }

  // Calcular vuelto
  const efectivoCentavos = payload.pagos
    .filter(p => p.medio_pago === 'efectivo')
    .reduce((acc, p) => acc + p.monto_centavos, 0);
  const otrosCentavos = payload.pagos
    .filter(p => p.medio_pago !== 'efectivo')
    .reduce((acc, p) => acc + p.monto_centavos, 0);
  const necesarioEfectivo = Math.max(0, totalCentavos - otrosCentavos);
  const vueltoCentavos = efectivoCentavos > 0 ? Math.max(0, efectivoCentavos - necesarioEfectivo) : 0;

  // Derivar forma_pago legacy (campo del schema solo admite efectivo|cuenta_corriente|transferencia|tarjeta)
  const primerMedio = payload.pagos[0]?.medio_pago ?? 'efectivo';
  const formaPago: 'efectivo' | 'cuenta_corriente' | 'transferencia' | 'tarjeta' =
    primerMedio === 'cheque' ? 'efectivo' : primerMedio;

  // Validar venta en espera si se está retomando
  let ventaEsperaRow: typeof schema.venta.$inferSelect | undefined;
  if (payload.venta_en_espera_id) {
    ventaEsperaRow = db.select().from(schema.venta)
      .where(eq(schema.venta.id, payload.venta_en_espera_id))
      .get();
    if (!ventaEsperaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
    if (ventaEsperaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');
  }

  const now = new Date();
  const ventaId = payload.venta_en_espera_id ?? generateId();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    const numero_interno = nextNumeroInterno(tx, terminal);

    if (payload.venta_en_espera_id && ventaEsperaRow) {
      tx.update(schema.venta).set({
        numero_interno,
        fecha: now,
        caja_id: payload.caja_id,
        cliente_id: payload.cliente_id,
        usuario_id: session.userId,
        subtotal: payload.subtotal,
        descuento_global: payload.descuento_global,
        importe_iva: payload.importe_iva,
        total: payload.total,
        ajuste_redondeo: payload.ajuste_redondeo,
        vuelto_centavos: vueltoCentavos,
        forma_pago: formaPago,
        estado: 'confirmada',
        presupuesto_id: payload.presupuesto_id ?? null,
        usuario_modificacion_id: session.userId,
        fecha_actualizacion: now,
        version: ventaEsperaRow.version + 1,
        sync_state: 'pending',
        updated_at: now,
      }).where(eq(schema.venta.id, ventaId)).run();

      tx.delete(schema.venta_detalle)
        .where(eq(schema.venta_detalle.venta_id, ventaId)).run();
    } else {
      tx.insert(schema.venta).values({
        id: ventaId,
        numero_interno,
        fecha: now,
        cliente_id: payload.cliente_id,
        usuario_id: session.userId,
        caja_id: payload.caja_id,
        subtotal: payload.subtotal,
        descuento_global: payload.descuento_global,
        importe_iva: payload.importe_iva,
        total: payload.total,
        ajuste_redondeo: payload.ajuste_redondeo,
        vuelto_centavos: vueltoCentavos,
        forma_pago: formaPago,
        estado: 'confirmada',
        comprobante_id: null,
        presupuesto_id: payload.presupuesto_id ?? null,
        usuario_creacion_id: session.userId,
        fecha_creacion: now,
        ...sync,
      }).run();
    }

    // ADR-046 §4: marca el presupuesto como convertido en la MISMA transaccion.
    // Condicionado a estado IN ('emitido','vencido'): si ya no es convertible, toda
    // la venta hace rollback.
    if (payload.presupuesto_id) {
      marcarPresupuestoConvertido(tx, payload.presupuesto_id, ventaId);
    }

    // Insertar filas en venta_pago y movimientos de caja por pago
    for (const pago of payload.pagos) {
      tx.insert(schema.venta_pago).values({
        id: generateId(),
        venta_id: ventaId,
        medio_pago: pago.medio_pago,
        monto_centavos: pago.monto_centavos,
        recargo_pct: pago.recargo_pct ?? 0,
        recargo_centavos: pago.recargo_centavos ?? 0,
        numero_cheque: pago.numero_cheque ?? null,
        banco: pago.banco ?? null,
        fecha_cheque: pago.fecha_cheque ? new Date(pago.fecha_cheque) : null,
        titular_cheque: pago.titular_cheque ?? null,
        ...sync,
      }).run();

      if (pago.medio_pago !== 'cuenta_corriente') {
        const montoCaja = (pago.monto_centavos + (pago.recargo_centavos ?? 0)) / 100;
        tx.insert(schema.movimiento_caja).values({
          id: generateId(),
          caja_id: payload.caja_id,
          tipo: 'ingreso',
          motivo: 'venta',
          monto: montoCaja,
          forma_pago: pago.medio_pago,
          referencia_tipo: 'venta',
          referencia_id: ventaId,
          usuario_id: session.userId,
          fecha: now,
          ...sync,
        }).run();
      }
    }

    // Registrar cargo en Cuenta Corriente para pagos CCC
    for (const pago of payload.pagos) {
      if (pago.medio_pago !== 'cuenta_corriente') continue;
      const cuenta = tx.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.cliente_id, payload.cliente_id))
        .get()!;
      const nuevoSaldo = cuenta.saldo_centavos + pago.monto_centavos;
      tx.insert(schema.movimiento_cuenta_corriente).values({
        id: generateId(),
        cuenta_id: cuenta.id,
        tipo: 'cargo',
        motivo: 'venta_credito',
        monto_centavos: pago.monto_centavos,
        saldo_resultante_centavos: nuevoSaldo,
        referencia_tipo: 'venta',
        referencia_id: ventaId,
        usuario_id: session.userId,
        fecha: now,
        ...sync,
      }).run();
      tx.update(schema.cuenta_corriente_cliente).set({
        saldo_centavos: nuevoSaldo,
        fecha_ultimo_movimiento: now,
        version: cuenta.version + 1,
        sync_state: 'pending',
        updated_at: now,
      }).where(eq(schema.cuenta_corriente_cliente.id, cuenta.id)).run();
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
        usuario_id: session.userId,
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

    const comprobanteId = generateId();
    tx.insert(schema.comprobante).values({
      id: comprobanteId,
      venta_id: ventaId,
      tipo: 'ticket_interno',
      fecha_emision: now,
      importe_neto: payload.total - payload.importe_iva,
      importe_iva: payload.importe_iva,
      importe_total: payload.total,
      estado: 'autorizado',
      ...sync,
    }).run();

    tx.update(schema.venta).set({ comprobante_id: comprobanteId })
      .where(eq(schema.venta.id, ventaId)).run();

    const venta = tx.select().from(schema.venta).where(eq(schema.venta.id, ventaId)).get()!;
    const detalles = tx.select().from(schema.venta_detalle)
      .where(eq(schema.venta_detalle.venta_id, ventaId)).all();
    const comprobante = tx.select().from(schema.comprobante)
      .where(eq(schema.comprobante.id, comprobanteId)).get()!;

    return { venta, detalles, comprobante };
  });
}

export function ventaAnularHandler(db: Db, payload: VentaAnularPayload) {
  const session = requireSession();
  if (!session.permisos.has('venta.anular')) throw new Error('FORBIDDEN');
  if (!payload.motivo?.trim()) throw new Error('MOTIVO_REQUERIDO');

  verificarSupervisor(db, payload.supervisor_credenciales);

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.venta_id)).get();
  if (!ventaRow) throw new Error('NOT_FOUND');
  if (ventaRow.estado === 'anulada') throw new Error('VENTA_YA_ANULADA');
  if (ventaRow.estado !== 'confirmada') throw new Error('VENTA_NO_CONFIRMADA');

  const cajaOrigen = db.select().from(schema.caja)
    .where(eq(schema.caja.id, ventaRow.caja_id)).get();
  if (!cajaOrigen || cajaOrigen.estado === 'cerrada') throw new Error('CAJA_ORIGEN_CERRADA');

  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, payload.venta_id)).all();

  const now = new Date();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    tx.update(schema.venta).set({
      estado: 'anulada',
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      version: ventaRow.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.venta.id, payload.venta_id)).run();

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
        referencia_id: payload.venta_id,
        usuario_id: session.userId,
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

    const pagoRows = tx.select().from(schema.venta_pago)
      .where(eq(schema.venta_pago.venta_id, payload.venta_id)).all();

    if (pagoRows.length > 0) {
      // Nueva lógica: egreso por cada pago no-CCC
      for (const pago of pagoRows) {
        if (pago.medio_pago === 'cuenta_corriente') continue;
        const montoCaja = (pago.monto_centavos + pago.recargo_centavos) / 100;
        tx.insert(schema.movimiento_caja).values({
          id: generateId(),
          caja_id: ventaRow.caja_id,
          tipo: 'egreso',
          motivo: 'ajuste',
          monto: montoCaja,
          forma_pago: pago.medio_pago,
          referencia_tipo: 'anulacion_venta',
          referencia_id: payload.venta_id,
          usuario_id: session.userId,
          fecha: now,
          observaciones: payload.motivo,
          ...sync,
        }).run();
      }
    } else {
      // Lógica legacy: ventas sin filas venta_pago
      tx.insert(schema.movimiento_caja).values({
        id: generateId(),
        caja_id: ventaRow.caja_id,
        tipo: 'egreso',
        motivo: 'ajuste',
        monto: ventaRow.total,
        forma_pago: ventaRow.forma_pago,
        referencia_tipo: 'anulacion_venta',
        referencia_id: payload.venta_id,
        usuario_id: session.userId,
        fecha: now,
        observaciones: payload.motivo,
        ...sync,
      }).run();
    }

    // Revertir cargos CCC si los hay
    const pagoCccRows = pagoRows.filter(p => p.medio_pago === 'cuenta_corriente');
    for (const pago of pagoCccRows) {
      const cuenta = tx.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.cliente_id, ventaRow.cliente_id))
        .get();
      if (!cuenta) continue;
      const nuevoSaldo = cuenta.saldo_centavos - pago.monto_centavos;
      tx.insert(schema.movimiento_cuenta_corriente).values({
        id: generateId(),
        cuenta_id: cuenta.id,
        tipo: 'pago',
        motivo: 'nota_credito',
        monto_centavos: pago.monto_centavos,
        saldo_resultante_centavos: nuevoSaldo,
        referencia_tipo: 'anulacion_venta',
        referencia_id: payload.venta_id,
        usuario_id: session.userId,
        fecha: now,
        ...sync,
      }).run();
      tx.update(schema.cuenta_corriente_cliente).set({
        saldo_centavos: nuevoSaldo,
        fecha_ultimo_movimiento: now,
        version: cuenta.version + 1,
        sync_state: 'pending',
        updated_at: now,
      }).where(eq(schema.cuenta_corriente_cliente.id, cuenta.id)).run();
    }

    return tx.select().from(schema.venta)
      .where(eq(schema.venta.id, payload.venta_id)).get()!;
  });
}

export function ventaListByCajaHandler(db: Db, payload: { caja_id: string }) {
  return db.select({
    id: schema.venta.id,
    numero_interno: schema.venta.numero_interno,
    fecha: schema.venta.fecha,
    total: schema.venta.total,
    estado: schema.venta.estado,
    forma_pago: schema.venta.forma_pago,
    cliente_nombre_raw: schema.cliente.nombre,
    cliente_apellido_raw: schema.cliente.apellido,
  }).from(schema.venta)
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.venta.cliente_id))
    .where(and(
      eq(schema.venta.caja_id, payload.caja_id),
      inArray(schema.venta.estado, ['confirmada', 'anulada']),
    ))
    .orderBy(desc(schema.venta.fecha))
    .all()
    .map(({ cliente_nombre_raw, cliente_apellido_raw, ...r }) => ({
      ...r,
      cliente_nombre: cliente_nombre_raw != null
        ? nombreCompletoCliente({ nombre: cliente_nombre_raw, apellido: cliente_apellido_raw })
        : null,
    }));
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
  ipcMain.handle('venta:listByCaja', async (_e, p) => ventaListByCajaHandler(db, p));
  ipcMain.handle('venta:get',        async (_e, p) => ventaGetHandler(db, p));
}
