import { describe, it, expect } from 'vitest';
import {
  resolverComponentesComerciales,
  calcularCostoNeto,
  costoNeto,
} from './costo.js';

// ADR-049 §1 — Costo neto: componentes comerciales como default por proveedor
// con override nullable por producto. Resolución: override ?? default ?? 0.

describe('resolverComponentesComerciales', () => {
  const defaults = {
    bonificacionPctDefault: 10,
    costoFinancieroPctDefault: 5,
    fletePctDefault: 3,
  };

  it('sin overrides hereda los defaults del proveedor', () => {
    const comp = resolverComponentesComerciales(
      { bonificacionPct: null, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      defaults,
    );
    expect(comp).toEqual({
      bonificacionPct: 10,
      costoFinancieroPct: 5,
      fletePct: 3,
      fleteCentavos: null,
      otrosCostosCentavos: 0,
    });
  });

  it('el override del producto pisa al default', () => {
    const comp = resolverComponentesComerciales(
      { bonificacionPct: 20, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      defaults,
    );
    expect(comp.bonificacionPct).toBe(20);
    expect(comp.costoFinancieroPct).toBe(5);
  });

  it('un override en 0 prevalece sobre un default no-cero', () => {
    const comp = resolverComponentesComerciales(
      { bonificacionPct: 0, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      defaults,
    );
    expect(comp.bonificacionPct).toBe(0);
  });

  it('con defaults en cero y sin overrides, todo queda en 0/null', () => {
    const comp = resolverComponentesComerciales(
      { bonificacionPct: null, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      { bonificacionPctDefault: 0, costoFinancieroPctDefault: 0, fletePctDefault: 0 },
    );
    expect(comp).toEqual({
      bonificacionPct: 0,
      costoFinancieroPct: 0,
      fletePct: 0,
      fleteCentavos: null,
      otrosCostosCentavos: 0,
    });
  });

  it('el flete absoluto y otros costos del override se conservan', () => {
    const comp = resolverComponentesComerciales(
      { bonificacionPct: null, costoFinancieroPct: null, fletePct: null, fleteCentavos: 1500, otrosCostosCentavos: 200 },
      defaults,
    );
    expect(comp.fleteCentavos).toBe(1500);
    expect(comp.otrosCostosCentavos).toBe(200);
  });
});

describe('calcularCostoNeto', () => {
  const cero = {
    bonificacionPct: 0,
    costoFinancieroPct: 0,
    fletePct: 0,
    fleteCentavos: null,
    otrosCostosCentavos: 0,
  };

  it('con todo en cero, costo neto = costo bruto', () => {
    const r = calcularCostoNeto(10000, cero);
    expect(r.netoCentavos).toBe(10000);
    expect(r.fleteCentavos).toBe(0);
    expect(r.bonificacionCentavos).toBe(0);
    expect(r.costoFinancieroCentavos).toBe(0);
  });

  it('el flete % se prorratea sobre el costo bruto', () => {
    const r = calcularCostoNeto(10000, { ...cero, fletePct: 5 });
    expect(r.fleteCentavos).toBe(500);
    expect(r.netoCentavos).toBe(10500);
  });

  it('el flete absoluto pisa al flete %', () => {
    const r = calcularCostoNeto(10000, { ...cero, fletePct: 5, fleteCentavos: 1500 });
    expect(r.fleteCentavos).toBe(1500);
    expect(r.netoCentavos).toBe(11500);
  });

  it('la bonificación descuenta del costo bruto', () => {
    const r = calcularCostoNeto(10000, { ...cero, bonificacionPct: 10 });
    expect(r.bonificacionCentavos).toBe(1000);
    expect(r.netoCentavos).toBe(9000);
  });

  it('bonificación del 100% anula el costo bruto', () => {
    const r = calcularCostoNeto(10000, { ...cero, bonificacionPct: 100 });
    expect(r.netoCentavos).toBe(0);
  });

  it('el costo financiero recarga sobre el subtotal (bruto − bonif + flete + otros)', () => {
    // (10000·0,9 + 500 + 200) · 1,10 = 9700 · 1,10 = 10670
    const r = calcularCostoNeto(10000, {
      bonificacionPct: 10,
      costoFinancieroPct: 10,
      fletePct: 5,
      fleteCentavos: null,
      otrosCostosCentavos: 200,
    });
    expect(r.bonificacionCentavos).toBe(1000);
    expect(r.fleteCentavos).toBe(500);
    expect(r.otrosCentavos).toBe(200);
    expect(r.costoFinancieroCentavos).toBe(970);
    expect(r.netoCentavos).toBe(10670);
  });

  it('el desglose es aditivo: bruto − bonif + flete + otros + costFin = neto', () => {
    const r = calcularCostoNeto(12345, {
      bonificacionPct: 7,
      costoFinancieroPct: 3,
      fletePct: 2,
      fleteCentavos: null,
      otrosCostosCentavos: 111,
    });
    const suma =
      r.brutoCentavos - r.bonificacionCentavos + r.fleteCentavos + r.otrosCentavos + r.costoFinancieroCentavos;
    expect(suma).toBe(r.netoCentavos);
  });

  it('redondea a centavo entero', () => {
    // round(333 · 1,10) = round(366,3) = 366
    const r = calcularCostoNeto(333, { ...cero, costoFinancieroPct: 10 });
    expect(r.netoCentavos).toBe(366);
  });
});

describe('costoNeto (resolver + calcular)', () => {
  it('combina la resolución de componentes con el cálculo', () => {
    const r = costoNeto(
      10000,
      { bonificacionPct: null, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      { bonificacionPctDefault: 10, costoFinancieroPctDefault: 0, fletePctDefault: 0 },
    );
    expect(r.netoCentavos).toBe(9000);
  });

  it('con defaults en cero y sin overrides, neto = bruto (comportamiento actual)', () => {
    const r = costoNeto(
      54321,
      { bonificacionPct: null, costoFinancieroPct: null, fletePct: null, fleteCentavos: null, otrosCostosCentavos: null },
      { bonificacionPctDefault: 0, costoFinancieroPctDefault: 0, fletePctDefault: 0 },
    );
    expect(r.netoCentavos).toBe(54321);
  });
});
