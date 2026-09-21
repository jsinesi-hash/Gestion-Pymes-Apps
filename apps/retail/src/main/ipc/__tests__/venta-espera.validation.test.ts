import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  ventaEsperaPausarHandler,
  ventaEsperaRetomarHandler,
  ventaEsperaDescartarHandler,
} from '../venta-espera';

describe('venta-espera validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('pausar rechaza lineas no-array con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaEsperaPausarHandler(db, { lineas: 'x' } as any))
      .toThrow(/VALIDATION:lineas:TIPO/);
  });

  it('pausar rechaza cantidad no numérica en una línea', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaEsperaPausarHandler(db, {
      lineas: [{ producto_id: 'p1', cantidad: 'dos' }],
    } as any)).toThrow(/VALIDATION:lineas\.0\.cantidad:TIPO/);
  });

  it('retomar rechaza venta_id ausente con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaEsperaRetomarHandler(db, {} as any))
      .toThrow(/VALIDATION:venta_id:TIPO/);
  });

  it('descartar rechaza venta_id vacío con REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ventaEsperaDescartarHandler(db, { venta_id: '' } as any))
      .toThrow(/VALIDATION:venta_id:REQUERIDO/);
  });
});
