import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { clienteUpsertHandler } from '../index';
import { cajaAbrirHandler } from '../index';
import {
  ctacteSetLimiteHandler,
  ctacteRegistrarSaldoInicialHandler,
  ctacteRegistrarCobroHandler,
} from '../index';
import * as schema from '@core/db';

type Db = ReturnType<typeof setupCoreDb>;
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

beforeEach(() => {
  db = setupCoreDb();
  loginAsAdmin(db);
  clienteId = crearClienteSinCCC(db);
  cuentaId = insertarCCC(db, clienteId, 50000); // saldo $500
});
afterEach(() => { clearSession(); });

describe('ctacteSetLimiteHandler — validación de payload (ADR-085)', () => {
  it('rechaza cuentaId vacío', () => {
    expect(() => ctacteSetLimiteHandler(db, { cuentaId: '', limite_centavos: 100 } as any))
      .toThrow('VALIDATION:cuentaId:REQUERIDO');
  });

  it('rechaza cuentaId omitido', () => {
    expect(() => ctacteSetLimiteHandler(db, { limite_centavos: 100 } as any))
      .toThrow('VALIDATION:cuentaId:TIPO');
  });

  it('rechaza limite_centavos no entero', () => {
    expect(() => ctacteSetLimiteHandler(db, { cuentaId, limite_centavos: 10.5 } as any))
      .toThrow('VALIDATION:limite_centavos:NO_ENTERO');
  });

  it('rechaza limite_centavos negativo', () => {
    expect(() => ctacteSetLimiteHandler(db, { cuentaId, limite_centavos: -1 } as any))
      .toThrow('VALIDATION:limite_centavos:NEGATIVO');
  });

  it('rechaza limite_centavos omitido', () => {
    expect(() => ctacteSetLimiteHandler(db, { cuentaId } as any))
      .toThrow('VALIDATION:limite_centavos:TIPO');
  });

  it('acepta payload válido', () => {
    const r = ctacteSetLimiteHandler(db, { cuentaId, limite_centavos: 200000 } as any);
    expect(r.ok).toBe(true);
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;
    expect(cuenta.limite_credito_centavos).toBe(200000);
  });
});

describe('ctacteRegistrarSaldoInicialHandler — validación de payload (ADR-085)', () => {
  let cuentaVaciaId: string;

  beforeEach(() => {
    const c2 = crearClienteSinCCC(db, '11111111');
    cuentaVaciaId = insertarCCC(db, c2, 0);
  });

  it('rechaza cuentaId vacío', () => {
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: '', monto_centavos: 1000, tipo: 'cargo' } as any))
      .toThrow('VALIDATION:cuentaId:REQUERIDO');
  });

  it('rechaza monto_centavos negativo', () => {
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: -1, tipo: 'cargo' } as any))
      .toThrow('VALIDATION:monto_centavos:NEGATIVO');
  });

  it('rechaza monto_centavos no entero', () => {
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 10.1, tipo: 'cargo' } as any))
      .toThrow('VALIDATION:monto_centavos:NO_ENTERO');
  });

  it('rechaza tipo inválido', () => {
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 1000, tipo: 'ajuste' } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('rechaza tipo omitido', () => {
    expect(() => ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 1000 } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('acepta payload válido', () => {
    const r = ctacteRegistrarSaldoInicialHandler(db, { cuentaId: cuentaVaciaId, monto_centavos: 30000, tipo: 'cargo' } as any);
    expect(r.saldo_centavos).toBe(30000);
  });
});

describe('ctacteRegistrarCobroHandler — validación de payload (ADR-085)', () => {
  it('rechaza cuentaId vacío', () => {
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId: '', monto_centavos: 100, forma_pago: 'transferencia' } as any))
      .toThrow('VALIDATION:cuentaId:REQUERIDO');
  });

  it('rechaza monto_centavos negativo', () => {
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: -100, forma_pago: 'transferencia' } as any))
      .toThrow('VALIDATION:monto_centavos:NEGATIVO');
  });

  it('rechaza monto_centavos no entero', () => {
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 10.5, forma_pago: 'transferencia' } as any))
      .toThrow('VALIDATION:monto_centavos:NO_ENTERO');
  });

  it('rechaza forma_pago inválida (cripto)', () => {
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 100, forma_pago: 'cripto' } as any))
      .toThrow('VALIDATION:forma_pago:ENUM');
  });

  it('rechaza forma_pago omitida', () => {
    expect(() => ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 100 } as any))
      .toThrow('VALIDATION:forma_pago:ENUM');
  });

  it('rechaza observaciones demasiado largas', () => {
    expect(() => ctacteRegistrarCobroHandler(db, {
      cuentaId, monto_centavos: 100, forma_pago: 'transferencia', observaciones: 'x'.repeat(1001),
    } as any)).toThrow('VALIDATION:observaciones:MAX:1000');
  });

  it('acepta payload válido sin observaciones (transferencia)', () => {
    const r = ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 10000, forma_pago: 'transferencia' } as any);
    expect(r.saldo_centavos).toBe(40000);
  });

  it('acepta payload válido con caja abierta (efectivo)', () => {
    cajaAbrirHandler(db, { monto_inicial: 0 });
    const r = ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 10000, forma_pago: 'efectivo' } as any);
    expect(r.saldo_centavos).toBe(40000);
  });
});
