import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { clienteUpsertHandler } from '../cliente';
import { cajaAbrirHandler } from '../caja';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let clienteId: string;
let cuentaId: string;

function crearClienteSinCCC(db: Db, doc = '12345678') {
  return clienteUpsertHandler(db, {
    tipo_documento: 'DNI',
    numero_documento: doc,
    nombre: 'Juan',
    apellido: 'Perez',
    condicion_fiscal: 'Consumidor Final',
  }).id;
}

function insertarCCC(db: Db, cId: string, saldo = 0, limite = 0) {
  const now = new Date();
  const id = generateId();
  db.insert(schema.cuenta_corriente_cliente).values({
    id,
    cliente_id: cId,
    saldo_centavos: saldo,
    limite_credito_centavos: limite,
    activo: true,
    version: 1,
    origin_id: 'test',
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return id;
}

function insertarMovCC(db: Db, cuentaId: string, tipo: 'cargo' | 'pago', monto: number) {
  const session = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!;
  const now = new Date();
  db.insert(schema.movimiento_cuenta_corriente).values({
    id: generateId(),
    cuenta_id: cuentaId,
    tipo,
    motivo: 'cobro',
    monto_centavos: monto,
    saldo_resultante_centavos: 0,
    usuario_id: session.id,
    fecha: now,
    version: 1,
    origin_id: 'test',
    sync_state: 'pending',
    updated_at: now,
  }).run();
}

beforeEach(() => {
  db = setupDb();
  clearSession();
  loginAsAdmin(db);
  clienteId = crearClienteSinCCC(db);
  cuentaId = insertarCCC(db, clienteId, 50000); // saldo $500
});

// ── ctacteListHandler ──────────────────────────────────────────────────────────

describe('ctacteListHandler', () => {
  it('retorna cuentas activas con info del cliente', async () => {
    const { ctacteListHandler } = await import('../ctacte');
    const result = ctacteListHandler(db);
    expect(result).toHaveLength(1);
    expect(result[0].nombre_completo).toBe('Juan Perez');
    expect(result[0].saldo_centavos).toBe(50000);
  });

  it('excedidos van primero', async () => {
    const { ctacteListHandler } = await import('../ctacte');
    const c2 = crearClienteSinCCC(db, '87654321');
    insertarCCC(db, c2, 20000, 10000); // saldo 200 > limite 100 → excedido
    const result = ctacteListHandler(db);
    expect(result[0].saldo_centavos).toBe(20000); // excedido primero
  });
});

// ── ctacteGetByClienteHandler ─────────────────────────────────────────────────

describe('ctacteGetByClienteHandler', () => {
  it('retorna CCC y movimientos ordenados DESC', async () => {
    const { ctacteGetByClienteHandler } = await import('../ctacte');
    insertarMovCC(db, cuentaId, 'cargo', 1000);
    insertarMovCC(db, cuentaId, 'pago', 500);
    const result = ctacteGetByClienteHandler(db, clienteId);
    expect(result.cuenta.id).toBe(cuentaId);
    expect(result.movimientos).toHaveLength(2);
    expect(result.movimientos[0].tipo).toBe('pago');
  });

  it('lanza NOT_FOUND para clienteId sin CCC', async () => {
    const { ctacteGetByClienteHandler } = await import('../ctacte');
    const otroCId = crearClienteSinCCC(db, '99999999');
    expect(() => ctacteGetByClienteHandler(db, otroCId)).toThrow('NOT_FOUND');
  });
});

// ── ctacteSetLimiteHandler ────────────────────────────────────────────────────

describe('ctacteSetLimiteHandler', () => {
  it('actualiza limite_credito_centavos', async () => {
    const { ctacteSetLimiteHandler } = await import('../ctacte');
    ctacteSetLimiteHandler(db, { cuentaId, limite_centavos: 200000 });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.limite_credito_centavos).toBe(200000);
  });

  it('lanza NOT_FOUND para cuentaId inválido', async () => {
    const { ctacteSetLimiteHandler } = await import('../ctacte');
    expect(() => ctacteSetLimiteHandler(db, { cuentaId: 'no-existe', limite_centavos: 0 }))
      .toThrow('NOT_FOUND');
  });
});

// ── ctacteRegistrarSaldoInicialHandler ────────────────────────────────────────

describe('ctacteRegistrarSaldoInicialHandler', () => {
  let cuentaVaciaId: string;

  beforeEach(() => {
    const c2 = crearClienteSinCCC(db, '11111111');
    cuentaVaciaId = insertarCCC(db, c2, 0);
  });

  it("tipo='cargo': saldo sube, movimiento tipo cargo motivo saldo_inicial", async () => {
    const { ctacteRegistrarSaldoInicialHandler } = await import('../ctacte');
    ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 30000, tipo: 'cargo' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaVaciaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(30000);
    const movs = db.select().from(schema.movimiento_cuenta_corriente)
      .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaVaciaId)).all();
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('cargo');
    expect(movs[0].motivo).toBe('saldo_inicial');
    expect(movs[0].saldo_resultante_centavos).toBe(30000);
  });

  it("tipo='pago': saldo baja (negativo), movimiento tipo pago motivo saldo_inicial", async () => {
    const { ctacteRegistrarSaldoInicialHandler } = await import('../ctacte');
    ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 15000, tipo: 'pago' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaVaciaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(-15000);
    const movs = db.select().from(schema.movimiento_cuenta_corriente)
      .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaVaciaId)).all();
    expect(movs[0].tipo).toBe('pago');
    expect(movs[0].motivo).toBe('saldo_inicial');
  });

  it('lanza CCC_YA_TIENE_MOVIMIENTOS si hay movimientos previos', async () => {
    const { ctacteRegistrarSaldoInicialHandler } = await import('../ctacte');
    insertarMovCC(db, cuentaVaciaId, 'cargo', 100);
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 1000, tipo: 'cargo' }))
      .toThrow('CCC_YA_TIENE_MOVIMIENTOS');
  });
});

// ── ctacteRegistrarCobroHandler ───────────────────────────────────────────────

describe('ctacteRegistrarCobroHandler', () => {
  it('transferencia: solo crea movimiento CC sin tocar caja', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 10000, forma_pago: 'transferencia' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(40000);
    const movs = db.select().from(schema.movimiento_cuenta_corriente)
      .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaId)).all();
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('pago');
    expect(movs[0].motivo).toBe('cobro');
    const movsCaja = db.select().from(schema.movimiento_caja).all();
    expect(movsCaja).toHaveLength(0);
  });

  it('efectivo + caja abierta: crea mov CC y mov caja en transacción', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 10000, forma_pago: 'efectivo' });
    const movsCaja = db.select().from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.caja_id, caja.id)).all();
    expect(movsCaja).toHaveLength(1);
    expect(movsCaja[0].tipo).toBe('ingreso');
    expect(movsCaja[0].motivo).toBe('cobro_cta_cte');
    expect(movsCaja[0].monto).toBeCloseTo(100);
    expect(movsCaja[0].referencia_tipo).toBe('movimiento_cc');
  });

  it('efectivo sin caja abierta: lanza CAJA_NO_ABIERTA', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 5000, forma_pago: 'efectivo' }))
      .toThrow('CAJA_NO_ABIERTA');
  });

  it('cobro parcial: saldo_resultante = saldo_anterior - monto', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 20000, forma_pago: 'transferencia' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(30000);
  });

  it('cobro total: saldo_resultante = 0', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 50000, forma_pago: 'transferencia' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(0);
  });

  it('cobro mayor al saldo: saldo_resultante negativo, sin error', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 80000, forma_pago: 'transferencia' });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.saldo_centavos).toBe(-30000);
  });

  it('lanza NOT_FOUND para cuentaId inválido', async () => {
    const { ctacteRegistrarCobroHandler } = await import('../ctacte');
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId: 'no-existe', monto_centavos: 100, forma_pago: 'transferencia' }))
      .toThrow('NOT_FOUND');
  });
});
