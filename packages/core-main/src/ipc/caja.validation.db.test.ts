import { describe, it, expect, beforeEach } from 'vitest';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { cajaAbrirHandler, cajaAddMovimientoHandler, cajaCerrarHandler } from '../index';
import * as schema from '@core/db';

describe('caja validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('abrir rechaza monto_inicial no numérico', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    expect(() => cajaAbrirHandler(db, { monto_inicial_centavos: 'mil' } as any))
      .toThrow(/VALIDATION:monto_inicial_centavos:TIPO/);
  });

  it('abrir rechaza monto_inicial_centavos negativo', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    expect(() => cajaAbrirHandler(db, { monto_inicial_centavos: -100 } as any))
      .toThrow(/VALIDATION:monto_inicial_centavos:NEGATIVO/);
  });

  it('abrir happy path intacto', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 1000 } as any);
    expect(caja.estado).toBe('abierta');
    expect(caja.monto_inicial_centavos).toBe(1000);
  });

  it('addMovimiento rechaza tipo inválido con ENUM', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'foo', motivo: 'retiro', monto_centavos: 100 } as any))
      .toThrow(/VALIDATION:tipo:ENUM/);
  });

  it('addMovimiento rechaza motivo inválido con ENUM', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'egreso', motivo: 'venta', monto_centavos: 100 } as any))
      .toThrow(/VALIDATION:motivo:ENUM/);
  });

  it('addMovimiento rechaza monto no numérico con TIPO', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'egreso', motivo: 'retiro', monto_centavos: 'cien' } as any))
      .toThrow(/VALIDATION:monto_centavos:TIPO/);
  });

  it('addMovimiento happy path intacto', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 1000 } as any);
    const mov = cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'egreso', motivo: 'retiro', monto_centavos: 200, forma_pago: 'efectivo' } as any);
    expect(mov.monto_centavos).toBe(200);
    expect(mov.motivo).toBe('retiro');
  });

  it('cerrar rechaza monto_contado no numérico con TIPO', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 1000 } as any);
    expect(() => cajaCerrarHandler(db, { caja_id: caja.id, monto_contado_centavos: 'mil' } as any))
      .toThrow(/VALIDATION:monto_contado_centavos:TIPO/);
  });

  it('ADR-157: el cierre compara la diferencia en centavos contra umbral_diferencia_caja_centavos', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const now = new Date();
    db.insert(schema.configuracion_negocio).values({ id: 'umbral_diferencia_caja_centavos', valor: '5000', tipo: 'number', origin_id: 'C1', updated_at: now }).run();
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 100_000 });
    // $ 50,00 de diferencia: justo en el umbral, no pide autorización.
    expect(cajaCerrarHandler(db, { caja_id: caja.id, monto_contado_centavos: 105_000 })).toMatchObject({ diferencia_centavos: 5000, monto_esperado_centavos: 100_000 });
    const otra = cajaAbrirHandler(db, { monto_inicial_centavos: 100_000 });
    // Un centavo más que el umbral: pide autorización.
    expect(() => cajaCerrarHandler(db, { caja_id: otra.id, monto_contado_centavos: 105_001 })).toThrow('DIFERENCIA_REQUIERE_AUTORIZACION');
  });

  it('cerrar happy path intacto (sin diferencia)', () => {
    const db = setupCoreDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 1000 } as any);
    const cerrada = cajaCerrarHandler(db, { caja_id: caja.id, monto_contado_centavos: 1000 } as any);
    expect(cerrada.estado).toBe('cerrada');
  });
});
