import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { cajaAbrirHandler, confirmarVenta, type ConfirmarVentaInput } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';

type Db = ReturnType<typeof setupDb>;
const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

function crearCliente(db: Db, conCuenta?: { limite: number }) {
  const clienteId = generateId();
  const now = new Date();
  const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
  const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  db.insert(schema.cliente).values({
    id: clienteId, tipo_documento: 'DNI', numero_documento: '11111111',
    nombre: 'Cli', apellido: 'Test', condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: !!conCuenta, activo: true,
    usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
  }).run();
  let cuentaId: string | null = null;
  if (conCuenta) {
    cuentaId = generateId();
    db.insert(schema.cuenta_corriente_cliente).values({
      id: cuentaId, cliente_id: clienteId, saldo_centavos: 0,
      limite_credito_centavos: conCuenta.limite, activo: true, ...sync,
    }).run();
  }
  return { clienteId, cuentaId };
}

function input(cajaId: string, clienteId: string, over: Partial<ConfirmarVentaInput> = {}): ConfirmarVentaInput {
  return {
    caja_id: cajaId, cliente_id: clienteId,
    subtotal: 1000, descuento_global: 0, importe_iva: 173.55, total: 1000, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }],
    ...over,
  };
}

describe('confirmarVenta (core)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function preparar(conCuenta?: { limite: number }) {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const cli = crearCliente(db, conCuenta);
    return { caja, ...cli };
  }

  it('confirma: crea el correlativo desde cero, venta, venta_pago, movimiento_caja y comprobante', () => {
    const { caja, clienteId } = preparar();
    const aplicarLineas = vi.fn();

    const { venta, comprobante } = confirmarVenta(db, input(caja.id, clienteId), { aplicarLineas });

    expect(venta.numero_interno).toBe('V-C1-000001');
    expect(venta.estado).toBe('confirmada');
    expect(venta.forma_pago).toBe('efectivo');
    expect(venta.comprobante_id).toBe(comprobante.id);
    expect(comprobante.tipo).toBe('ticket_interno');
    expect(comprobante.importe_total).toBe(1000);
    expect(aplicarLineas).toHaveBeenCalledTimes(1);
    expect(aplicarLineas.mock.calls[0][1]).toMatchObject({ ventaId: venta.id, esRetoma: false });

    const pagos = db.select().from(schema.venta_pago).where(eq(schema.venta_pago.venta_id, venta.id)).all();
    expect(pagos).toHaveLength(1);
    const movs = db.select().from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.referencia_id, venta.id)).all();
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: 'ingreso', motivo: 'venta', monto: 1000, forma_pago: 'efectivo' });
  });

  it('el correlativo incrementa por venta', () => {
    const { caja, clienteId } = preparar();
    const hooks = { aplicarLineas: vi.fn() };
    confirmarVenta(db, input(caja.id, clienteId), hooks);
    const { venta } = confirmarVenta(db, input(caja.id, clienteId), hooks);
    expect(venta.numero_interno).toBe('V-C1-000002');
  });

  it('calcula el vuelto cuando el efectivo excede lo necesario', () => {
    const { caja, clienteId } = preparar();
    const { venta } = confirmarVenta(db, input(caja.id, clienteId, {
      total: 800, subtotal: 800, pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }],
    }), { aplicarLineas: vi.fn() });
    expect(venta.vuelto_centavos).toBe(20000);
  });

  it('rollback total (incluido el correlativo) si aplicarLineas lanza', () => {
    const { caja, clienteId } = preparar();
    expect(() => confirmarVenta(db, input(caja.id, clienteId), {
      aplicarLineas: () => { throw new Error('BOOM'); },
    })).toThrow('BOOM');
    expect(db.select().from(schema.venta).all()).toHaveLength(0);
    expect(db.select().from(schema.movimiento_caja).where(eq(schema.movimiento_caja.motivo, 'venta')).all()).toHaveLength(0);
    expect(db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'venta_correlativo_C1')).all()).toHaveLength(0);
  });

  it('validarPrevio lanzando aborta antes de persistir nada', () => {
    const { caja, clienteId } = preparar();
    const aplicarLineas = vi.fn();
    expect(() => confirmarVenta(db, input(caja.id, clienteId), {
      validarPrevio: () => { throw new Error('STOCK_INSUFICIENTE'); }, aplicarLineas,
    })).toThrow('STOCK_INSUFICIENTE');
    expect(aplicarLineas).not.toHaveBeenCalled();
    expect(db.select().from(schema.venta).all()).toHaveLength(0);
  });

  it('errores de validación: sesión, caja, pagos', () => {
    const { caja, clienteId } = preparar();
    const hooks = { aplicarLineas: vi.fn() };
    expect(() => confirmarVenta(db, input('no-existe', clienteId), hooks)).toThrow('CAJA_REQUERIDA');
    expect(() => confirmarVenta(db, input(caja.id, clienteId, { pagos: [] }), hooks)).toThrow('PAGOS_REQUERIDOS');
    expect(() => confirmarVenta(db, input(caja.id, clienteId, {
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 60000 }, { medio_pago: 'efectivo', monto_centavos: 40000 }],
    }), hooks)).toThrow('MEDIO_PAGO_DUPLICADO');
    expect(() => confirmarVenta(db, input(caja.id, clienteId, {
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 99999 }],
    }), hooks)).toThrow('SALDO_PENDIENTE');
    clearSession();
    expect(() => confirmarVenta(db, input(caja.id, clienteId), hooks)).toThrow('UNAUTHENTICATED');
    expect(hooks.aplicarLineas).not.toHaveBeenCalled();
  });

  it('cuenta corriente: carga el saldo y no genera movimiento de caja', () => {
    const { caja, clienteId, cuentaId } = preparar({ limite: 500_000 });
    const { venta } = confirmarVenta(db, input(caja.id, clienteId, {
      pagos: [{ medio_pago: 'cuenta_corriente', monto_centavos: 100000 }],
    }), { aplicarLineas: vi.fn() });

    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId!)).get()!;
    expect(cuenta.saldo_centavos).toBe(100000);
    const mov = db.select().from(schema.movimiento_cuenta_corriente)
      .where(eq(schema.movimiento_cuenta_corriente.referencia_id, venta.id)).all();
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ tipo: 'cargo', motivo: 'venta_credito', saldo_resultante_centavos: 100000 });
    expect(db.select().from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.referencia_id, venta.id)).all()).toHaveLength(0);
  });

  it('cuenta corriente: sin cuenta → CCC_NO_DISPONIBLE; sobre el límite exige supervisor', () => {
    const sinCuenta = preparar();
    const hooks = { aplicarLineas: vi.fn() };
    expect(() => confirmarVenta(db, input(sinCuenta.caja.id, sinCuenta.clienteId, {
      pagos: [{ medio_pago: 'cuenta_corriente', monto_centavos: 100000 }],
    }), hooks)).toThrow('CCC_NO_DISPONIBLE');

    const { clienteId } = crearCliente(db, { limite: 50_000 });
    const pagos = [{ medio_pago: 'cuenta_corriente' as const, monto_centavos: 100000 }];
    expect(() => confirmarVenta(db, input(sinCuenta.caja.id, clienteId, { pagos }), hooks))
      .toThrow('LIMITE_CREDITO_EXCEDIDO');
    const { venta } = confirmarVenta(db, input(sinCuenta.caja.id, clienteId, {
      pagos, supervisor_credenciales: SUP,
    }), hooks);
    expect(venta.estado).toBe('confirmada');
  });

  it('retomar una venta en espera reusa el id, sube la versión y marca esRetoma', () => {
    const { caja, clienteId } = preparar();
    const ventaId = generateId();
    const now = new Date();
    const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
    db.insert(schema.venta).values({
      id: ventaId, numero_interno: 'HOLD:abc', fecha: now, cliente_id: clienteId,
      usuario_id: adminId, caja_id: caja.id, subtotal: 1000, descuento_global: 0,
      importe_iva: 0, total: 1000, ajuste_redondeo: 0, forma_pago: 'efectivo',
      estado: 'en_espera', usuario_creacion_id: adminId, fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    const aplicarLineas = vi.fn();

    const { venta } = confirmarVenta(db, input(caja.id, clienteId, { venta_en_espera_id: ventaId }), { aplicarLineas });

    expect(venta.id).toBe(ventaId);
    expect(venta.estado).toBe('confirmada');
    expect(venta.version).toBe(2);
    expect(venta.numero_interno).toBe('V-C1-000001');
    expect(aplicarLineas.mock.calls[0][1]).toMatchObject({ ventaId, esRetoma: true });

    expect(() => confirmarVenta(db, input(caja.id, clienteId, { venta_en_espera_id: ventaId }), { aplicarLineas }))
      .toThrow('VENTA_NO_EN_ESPERA');
    expect(() => confirmarVenta(db, input(caja.id, clienteId, { venta_en_espera_id: generateId() }), { aplicarLineas }))
      .toThrow('VENTA_ESPERA_NOT_FOUND');
  });
});
