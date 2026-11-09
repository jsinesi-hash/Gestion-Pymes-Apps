import { eq, and } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { verificarAutorizacion } from '../auth/verificarAutorizacion';
import type {
  VentaDb, VentaTx, VentaRow, ComprobanteRow, SyncFields,
  ConfirmarVentaInput, ConfirmarVentaHooks,
} from './types';

function siguienteNumeroInterno(tx: VentaTx, terminal: string, now: Date): string {
  const clave = `venta_correlativo_${terminal}`;
  const param = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  let correlativo: number;
  if (!param) {
    // Retail lo siembra por migración SQL; las demás apps lo crean en la 1ª venta.
    correlativo = 1;
    tx.insert(schema.parametros_sistema).values({
      clave, valor: '1', tipo: 'number',
      descripcion: `Correlativo de ventas de la terminal ${terminal}`,
      actualizado_en: now,
    }).run();
  } else {
    correlativo = Number.parseInt(param.valor) + 1;
    tx.update(schema.parametros_sistema)
      .set({ valor: String(correlativo), actualizado_en: now })
      .where(eq(schema.parametros_sistema.clave, clave)).run();
  }
  return `V-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

export function confirmarVenta(
  db: VentaDb,
  input: ConfirmarVentaInput,
  hooks: ConfirmarVentaHooks,
): { venta: VentaRow; comprobante: ComprobanteRow } {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const cajaRow = db.select().from(schema.caja)
    .where(and(eq(schema.caja.id, input.caja_id), eq(schema.caja.estado, 'abierta'))).get();
  if (!cajaRow) throw new Error('CAJA_REQUERIDA');

  if (input.pagos.length === 0) throw new Error('PAGOS_REQUERIDOS');
  // Un mismo medio no puede aparecer dos veces: se carga en una sola línea por su total.
  const mediosUsados = new Set(input.pagos.map(p => p.medio_pago));
  if (mediosUsados.size !== input.pagos.length) throw new Error('MEDIO_PAGO_DUPLICADO');
  const totalCentavos = Math.round(input.total * 100);
  const sumPagosCentavos = input.pagos.reduce((acc, p) => acc + p.monto_centavos, 0);
  if (sumPagosCentavos < totalCentavos) throw new Error('SALDO_PENDIENTE');

  hooks.validarPrevio?.();

  // Límite de crédito de cuenta corriente
  const pagosCcc = input.pagos.filter(p => p.medio_pago === 'cuenta_corriente');
  if (pagosCcc.length > 0) {
    const montoCccTotal = pagosCcc.reduce((acc, p) => acc + p.monto_centavos, 0);
    const cuentaRow = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, input.cliente_id)).get();
    if (!cuentaRow || !cuentaRow.activo) throw new Error('CCC_NO_DISPONIBLE');
    if (cuentaRow.limite_credito_centavos > 0 &&
        cuentaRow.saldo_centavos + montoCccTotal > cuentaRow.limite_credito_centavos) {
      if (!input.supervisor_credenciales) throw new Error('LIMITE_CREDITO_EXCEDIDO');
      verificarAutorizacion(db, input.supervisor_credenciales, 'ctacte.autorizar_exceso');
    }
  }

  // Vuelto
  const efectivoCentavos = input.pagos
    .filter(p => p.medio_pago === 'efectivo').reduce((acc, p) => acc + p.monto_centavos, 0);
  const otrosCentavos = input.pagos
    .filter(p => p.medio_pago !== 'efectivo').reduce((acc, p) => acc + p.monto_centavos, 0);
  const necesarioEfectivo = Math.max(0, totalCentavos - otrosCentavos);
  const vueltoCentavos = efectivoCentavos > 0 ? Math.max(0, efectivoCentavos - necesarioEfectivo) : 0;

  // forma_pago legado: el schema solo admite efectivo|cuenta_corriente|transferencia|tarjeta
  const primerMedio = input.pagos[0]?.medio_pago ?? 'efectivo';
  const formaPago: 'efectivo' | 'cuenta_corriente' | 'transferencia' | 'tarjeta' =
    primerMedio === 'cheque' ? 'efectivo' : primerMedio;

  // Venta en espera que se retoma
  let ventaEsperaRow: VentaRow | undefined;
  if (input.venta_en_espera_id) {
    ventaEsperaRow = db.select().from(schema.venta)
      .where(eq(schema.venta.id, input.venta_en_espera_id)).get();
    if (!ventaEsperaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
    if (ventaEsperaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');
  }

  const now = new Date();
  const ventaId = input.venta_en_espera_id ?? generateId();
  const terminal = getOriginId();
  const sync: SyncFields = { version: 1, origin_id: terminal, sync_state: 'pending', updated_at: now };

  return db.transaction((tx) => {
    const numero_interno = siguienteNumeroInterno(tx, terminal, now);

    if (ventaEsperaRow) {
      tx.update(schema.venta).set({
        numero_interno,
        fecha: now,
        caja_id: input.caja_id,
        cliente_id: input.cliente_id,
        usuario_id: session.userId,
        subtotal: input.subtotal,
        descuento_global: input.descuento_global,
        importe_iva: input.importe_iva,
        total: input.total,
        ajuste_redondeo: input.ajuste_redondeo,
        vuelto_centavos: vueltoCentavos,
        forma_pago: formaPago,
        estado: 'confirmada',
        presupuesto_id: input.presupuesto_id ?? null,
        usuario_modificacion_id: session.userId,
        fecha_actualizacion: now,
        version: ventaEsperaRow.version + 1,
        sync_state: 'pending',
        updated_at: now,
      }).where(eq(schema.venta.id, ventaId)).run();
    } else {
      tx.insert(schema.venta).values({
        id: ventaId,
        numero_interno,
        fecha: now,
        cliente_id: input.cliente_id,
        usuario_id: session.userId,
        caja_id: input.caja_id,
        subtotal: input.subtotal,
        descuento_global: input.descuento_global,
        importe_iva: input.importe_iva,
        total: input.total,
        ajuste_redondeo: input.ajuste_redondeo,
        vuelto_centavos: vueltoCentavos,
        forma_pago: formaPago,
        estado: 'confirmada',
        comprobante_id: null,
        presupuesto_id: input.presupuesto_id ?? null,
        usuario_creacion_id: session.userId,
        fecha_creacion: now,
        ...sync,
      }).run();
    }

    // venta_pago + movimiento_caja por medio de pago (cta cte no mueve caja)
    for (const pago of input.pagos) {
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
          caja_id: input.caja_id,
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

    // Cargo en cuenta corriente
    for (const pago of input.pagos) {
      if (pago.medio_pago !== 'cuenta_corriente') continue;
      const cuenta = tx.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.cliente_id, input.cliente_id)).get()!;
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

    // Líneas + inventario + efectos propios de la app (p. ej. presupuesto convertido)
    hooks.aplicarLineas(tx, {
      ventaId, now, sync, userId: session.userId, esRetoma: !!ventaEsperaRow,
    });

    const comprobanteId = generateId();
    tx.insert(schema.comprobante).values({
      id: comprobanteId,
      venta_id: ventaId,
      tipo: 'ticket_interno',
      fecha_emision: now,
      importe_neto: input.total - input.importe_iva,
      importe_iva: input.importe_iva,
      importe_total: input.total,
      estado: 'autorizado',
      ...sync,
    }).run();

    tx.update(schema.venta).set({ comprobante_id: comprobanteId })
      .where(eq(schema.venta.id, ventaId)).run();

    const venta = tx.select().from(schema.venta).where(eq(schema.venta.id, ventaId)).get()!;
    const comprobante = tx.select().from(schema.comprobante)
      .where(eq(schema.comprobante.id, comprobanteId)).get()!;
    return { venta, comprobante };
  });
}
