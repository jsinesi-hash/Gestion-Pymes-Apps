import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { verificarAutorizacion } from '../auth/verificarAutorizacion';
import type {
  VentaDb, VentaRow, SyncFields, AnularVentaInput, AnularVentaHooks,
} from './types';

export function anularVenta(
  db: VentaDb,
  input: AnularVentaInput,
  hooks: AnularVentaHooks,
): VentaRow {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('venta.anular')) throw new Error('FORBIDDEN');
  if (!input.motivo?.trim()) throw new Error('MOTIVO_REQUERIDO');

  verificarAutorizacion(db, input.supervisor_credenciales, 'venta.anular');

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, input.venta_id)).get();
  if (!ventaRow) throw new Error('NOT_FOUND');
  if (ventaRow.estado === 'anulada') throw new Error('VENTA_YA_ANULADA');
  if (ventaRow.estado !== 'confirmada') throw new Error('VENTA_NO_CONFIRMADA');

  const cajaOrigen = db.select().from(schema.caja)
    .where(eq(schema.caja.id, ventaRow.caja_id)).get();
  if (!cajaOrigen || cajaOrigen.estado === 'cerrada') throw new Error('CAJA_ORIGEN_CERRADA');

  const now = new Date();
  const terminal = getOriginId();
  const sync: SyncFields = { version: 1, origin_id: terminal, sync_state: 'pending', updated_at: now };

  return db.transaction((tx) => {
    tx.update(schema.venta).set({
      estado: 'anulada',
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      version: ventaRow.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.venta.id, input.venta_id)).run();

    hooks.revertirLineas(tx, { venta: ventaRow, now, sync, userId: session.userId, motivo: input.motivo });

    const pagoRows = tx.select().from(schema.venta_pago)
      .where(eq(schema.venta_pago.venta_id, input.venta_id)).all();

    if (pagoRows.length > 0) {
      // Egreso por cada pago no-CCC
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
          referencia_id: input.venta_id,
          usuario_id: session.userId,
          fecha: now,
          observaciones: input.motivo,
          ...sync,
        }).run();
      }
    } else {
      // Legado: ventas sin filas venta_pago
      tx.insert(schema.movimiento_caja).values({
        id: generateId(),
        caja_id: ventaRow.caja_id,
        tipo: 'egreso',
        motivo: 'ajuste',
        monto: ventaRow.total,
        forma_pago: ventaRow.forma_pago,
        referencia_tipo: 'anulacion_venta',
        referencia_id: input.venta_id,
        usuario_id: session.userId,
        fecha: now,
        observaciones: input.motivo,
        ...sync,
      }).run();
    }

    // Revertir cargos de cuenta corriente
    for (const pago of pagoRows.filter(p => p.medio_pago === 'cuenta_corriente')) {
      const cuenta = tx.select().from(schema.cuenta_corriente_cliente)
        .where(eq(schema.cuenta_corriente_cliente.cliente_id, ventaRow.cliente_id)).get();
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
        referencia_id: input.venta_id,
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
      .where(eq(schema.venta.id, input.venta_id)).get()!;
  });
}
