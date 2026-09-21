import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { ventaConfirmarHandler } from '../venta';

// ADR-082 (SEC-2): la validación de forma/tipo corre DESPUÉS de sesión+permiso pero
// ANTES de la lógica de negocio (caja, stock, pagos). Por eso estos casos malformados
// no necesitan caja abierta: fallan en el borde.
describe('venta confirmar validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('rechaza lineas no-array con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, { lineas: 'x', pagos: [] } as any))
      .toThrow(/VALIDATION:lineas:TIPO/);
  });

  it('rechaza pagos no-array con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, { lineas: [], pagos: 'x' } as any))
      .toThrow(/VALIDATION:pagos:TIPO/);
  });

  it('rechaza cantidad no numérica en una línea', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, {
      lineas: [{ producto_id: 'p1', cantidad: 'dos' }], pagos: [],
    } as any)).toThrow(/VALIDATION:lineas\.0\.cantidad:TIPO/);
  });

  it('rechaza producto_id vacío en una línea', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, {
      lineas: [{ producto_id: '', cantidad: 1 }], pagos: [],
    } as any)).toThrow(/VALIDATION:lineas\.0\.producto_id:REQUERIDO/);
  });

  it('rechaza medio_pago inválido con ENUM', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, {
      lineas: [], pagos: [{ medio_pago: 'crypto', monto_centavos: 100 }],
    } as any)).toThrow(/VALIDATION:pagos\.0\.medio_pago:ENUM/);
  });

  it('rechaza monto_centavos no entero con NO_ENTERO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaConfirmarHandler(db, {
      lineas: [], pagos: [{ medio_pago: 'efectivo', monto_centavos: 100.5 }],
    } as any)).toThrow(/VALIDATION:pagos\.0\.monto_centavos:NO_ENTERO/);
  });
});
