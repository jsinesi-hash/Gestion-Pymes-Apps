import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { cajaAbrirHandler, cajaAddMovimientoHandler, cajaCerrarHandler } from '../caja';

describe('caja validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('abrir rechaza monto_inicial no numérico', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => cajaAbrirHandler(db, { monto_inicial: 'mil' } as any))
      .toThrow(/VALIDATION:monto_inicial:TIPO/);
  });

  it('abrir rechaza monto_inicial negativo con MIN:0', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => cajaAbrirHandler(db, { monto_inicial: -100 } as any))
      .toThrow(/VALIDATION:monto_inicial:MIN:0/);
  });

  it('abrir happy path intacto', () => {
    const db = setupDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 1000 } as any);
    expect(caja.estado).toBe('abierta');
    expect(caja.monto_inicial).toBe(1000);
  });

  it('addMovimiento rechaza tipo inválido con ENUM', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'foo', motivo: 'retiro', monto: 100 } as any))
      .toThrow(/VALIDATION:tipo:ENUM/);
  });

  it('addMovimiento rechaza motivo inválido con ENUM', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'egreso', motivo: 'venta', monto: 100 } as any))
      .toThrow(/VALIDATION:motivo:ENUM/);
  });

  it('addMovimiento rechaza monto no numérico con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => cajaAddMovimientoHandler(db, { caja_id: 'c1', tipo: 'egreso', motivo: 'retiro', monto: 'cien' } as any))
      .toThrow(/VALIDATION:monto:TIPO/);
  });

  it('addMovimiento happy path intacto', () => {
    const db = setupDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 1000 } as any);
    const mov = cajaAddMovimientoHandler(db, { caja_id: caja.id, tipo: 'egreso', motivo: 'retiro', monto: 200, forma_pago: 'efectivo' } as any);
    expect(mov.monto).toBe(200);
    expect(mov.motivo).toBe('retiro');
  });

  it('cerrar rechaza monto_contado no numérico con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 1000 } as any);
    expect(() => cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 'mil' } as any))
      .toThrow(/VALIDATION:monto_contado:TIPO/);
  });

  it('cerrar happy path intacto (sin diferencia)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 1000 } as any);
    const cerrada = cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 1000 } as any);
    expect(cerrada.estado).toBe('cerrada');
  });
});
