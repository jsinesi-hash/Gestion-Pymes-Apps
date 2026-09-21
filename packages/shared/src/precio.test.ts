import { describe, it, expect } from 'vitest';
import { resolverPrecio, redondearPeso, ajusteEfectivo, redondearComercial } from './precio.js';

describe('ajusteEfectivo', () => {
  it('usa override cuando no es null', () => {
    expect(ajusteEfectivo(-10, -8)).toBe(-8);
  });
  it('usa general cuando override es null', () => {
    expect(ajusteEfectivo(-10, null)).toBe(-10);
  });
  it('override 0 prevalece sobre general no-cero', () => {
    expect(ajusteEfectivo(-10, 0)).toBe(0);
  });
});

describe('resolverPrecio', () => {
  it('sin lista sin descuentos: precio = base', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 125000, ajustePct: 0, descuentoLineaPct: 0, cantidad: 1 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].precioUnitarioCentavos).toBe(125000);
    expect(r.totalCentavos).toBe(125000);
  });

  it('ajuste general +10%', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 100000, ajustePct: 10, descuentoLineaPct: 0, cantidad: 1 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].precioUnitarioCentavos).toBe(110000);
  });

  it('ajuste general -10%', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 100000, ajustePct: -10, descuentoLineaPct: 0, cantidad: 1 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].precioUnitarioCentavos).toBe(90000);
  });

  it('override -8% pisa ajuste general -10% (no suma, no encadena)', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 100000, ajustePct: -8, descuentoLineaPct: 0, cantidad: 1 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].precioUnitarioCentavos).toBe(92000);
  });

  it('descuento de línea se aplica después del ajuste de lista', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 100000, ajustePct: 20, descuentoLineaPct: 10, cantidad: 1 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].precioUnitarioCentavos).toBe(108000);
  });

  it('descuento global se aplica sobre suma de subtotales', () => {
    const r = resolverPrecio({
      lineas: [
        { precioListaCentavos: 100000, ajustePct: 0, descuentoLineaPct: 0, cantidad: 1 },
        { precioListaCentavos: 200000, ajustePct: 0, descuentoLineaPct: 0, cantidad: 1 },
      ],
      descuentoGlobalPct: 10,
    });
    expect(r.subtotalCentavos).toBe(300000);
    expect(r.descuentoGlobalCentavos).toBe(30000);
    expect(r.totalCentavos).toBe(270000);
  });

  it('múltiples líneas con ajustes distintos — subtotales independientes', () => {
    const r = resolverPrecio({
      lineas: [
        { precioListaCentavos: 100000, ajustePct: 10, descuentoLineaPct: 0, cantidad: 2 },
        { precioListaCentavos: 50000, ajustePct: -10, descuentoLineaPct: 5, cantidad: 3 },
      ],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].subtotalCentavos).toBe(220000);
    expect(r.lineas[1].precioUnitarioCentavos).toBe(42750);
    expect(r.lineas[1].subtotalCentavos).toBe(128250);
  });

  it('cantidad decimal (fracción)', () => {
    const r = resolverPrecio({
      lineas: [{ precioListaCentavos: 100000, ajustePct: 0, descuentoLineaPct: 0, cantidad: 0.5 }],
      descuentoGlobalPct: 0,
    });
    expect(r.lineas[0].subtotalCentavos).toBe(50000);
  });
});

describe('redondearPeso', () => {
  it('0 centavos sobrantes → ajuste = 0', () => {
    const r = redondearPeso(125000);
    expect(r.totalCentavos).toBe(125000);
    expect(r.ajusteRedondeoCentavos).toBe(0);
  });

  it('exactamente 50 centavos → redondea arriba, ajuste = +50', () => {
    const r = redondearPeso(125050);
    expect(r.totalCentavos).toBe(125100);
    expect(r.ajusteRedondeoCentavos).toBe(50);
  });

  it('49 centavos → redondea abajo, ajuste = -49', () => {
    const r = redondearPeso(125049);
    expect(r.totalCentavos).toBe(125000);
    expect(r.ajusteRedondeoCentavos).toBe(-49);
  });

  it('invariante: ajusteRedondeo siempre en [-50, +50] para cualquier centavo 0..199', () => {
    for (let c = 0; c < 200; c++) {
      const { ajusteRedondeoCentavos } = redondearPeso(c);
      expect(ajusteRedondeoCentavos).toBeGreaterThanOrEqual(-50);
      expect(ajusteRedondeoCentavos).toBeLessThanOrEqual(50);
    }
  });
});

// ADR-049 §3 — redondeo comercial (se aplica al precio de lista después del margen,
// independiente de redondearPeso, que sigue aplicando al total de la venta).
describe('redondearComercial', () => {
  it('modo ninguno devuelve el valor sin tocar', () => {
    expect(redondearComercial(14990, 'ninguno')).toBe(14990);
  });

  it('terminacion_90 lleva al valor más cercano terminado en ,90', () => {
    expect(redondearComercial(14000, 'terminacion_90')).toBe(13990);
    expect(redondearComercial(14050, 'terminacion_90')).toBe(14090);
    expect(redondearComercial(900, 'terminacion_90')).toBe(890);
  });

  it('terminacion_90 nunca baja de 90 centavos', () => {
    expect(redondearComercial(40, 'terminacion_90')).toBe(90);
  });

  it('terminacion_99 lleva al valor más cercano terminado en ,99', () => {
    expect(redondearComercial(15000, 'terminacion_99')).toBe(14999);
  });

  it('multiplo redondea al múltiplo de centavos indicado', () => {
    expect(redondearComercial(14990, 'multiplo', 100)).toBe(15000);
    expect(redondearComercial(14940, 'multiplo', 100)).toBe(14900);
    expect(redondearComercial(12300, 'multiplo', 500)).toBe(12500);
  });

  it('multiplo sin valor válido no rompe (devuelve el valor original)', () => {
    expect(redondearComercial(12345, 'multiplo', null)).toBe(12345);
    expect(redondearComercial(12345, 'multiplo', 0)).toBe(12345);
  });
});
