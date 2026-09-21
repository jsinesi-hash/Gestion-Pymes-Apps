import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { setManualHandler } from '../lista-precio-valor';

describe('lista-precio-valor setManual validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('rechaza listaId ausente con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => setManualHandler(db, { productoId: 'p1', precioCentavos: 1000 } as any))
      .toThrow(/VALIDATION:listaId:TIPO/);
  });

  it('rechaza productoId vacío con REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => setManualHandler(db, { listaId: 'l1', productoId: '', precioCentavos: 1000 } as any))
      .toThrow(/VALIDATION:productoId:REQUERIDO/);
  });

  it('rechaza precioCentavos no entero con NO_ENTERO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => setManualHandler(db, { listaId: 'l1', productoId: 'p1', precioCentavos: 10.5 } as any))
      .toThrow(/VALIDATION:precioCentavos:NO_ENTERO/);
  });

  it('rechaza precioCentavos negativo con NEGATIVO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => setManualHandler(db, { listaId: 'l1', productoId: 'p1', precioCentavos: -1 } as any))
      .toThrow(/VALIDATION:precioCentavos:NEGATIVO/);
  });
});
