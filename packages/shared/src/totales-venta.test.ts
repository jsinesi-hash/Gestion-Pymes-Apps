import { describe, it, expect } from 'vitest';
import { resolverPrecio, redondearPeso } from './precio.js';
import { verificarTotalesVenta, type TotalesVentaInput } from './totales-venta.js';

// Revisión 2026-10-20 (P1): `confirmarVenta` de Retail recibía subtotal/IVA/total/ajuste calculados
// por el renderer y solo re-verificaba el precio unitario. Acá se recalcula todo en centavos con la
// misma fórmula del POS (usePosSession.confirmar) y se rechaza lo inconsistente.

type LineaPos = { precioListaCentavos: number; ajustePct: number; descuentoLineaPct: number; cantidad: number; alicuota: number };

/** Arma el payload EXACTAMENTE como lo hace usePosSession.confirmar. */
function payloadComoElPos(lineas: LineaPos[], descuentoGlobalPct: number): TotalesVentaInput {
  const r = resolverPrecio({
    lineas: lineas.map((l) => ({
      precioListaCentavos: l.precioListaCentavos, ajustePct: l.ajustePct,
      descuentoLineaPct: l.descuentoLineaPct, cantidad: l.cantidad,
    })),
    descuentoGlobalPct,
  });
  const red = redondearPeso(r.totalCentavos);
  const lp = lineas.map((l, i) => ({
    cantidad: l.cantidad,
    precio_unitario: r.lineas[i]!.precioUnitarioCentavos / 100,
    descuento_linea: l.descuentoLineaPct,
    alicuota_iva: l.alicuota,
    subtotal: r.lineas[i]!.subtotalCentavos / 100,
  }));
  const importe_iva = lp.reduce((s, l) => s + l.subtotal * l.alicuota_iva / (100 + l.alicuota_iva), 0);
  return {
    lineas: lp,
    descuento_global: descuentoGlobalPct,
    subtotal: r.subtotalCentavos / 100,
    importe_iva,
    total: red.totalCentavos / 100,
    ajuste_redondeo: red.ajusteRedondeoCentavos / 100,
  };
}

const CARRITO: LineaPos[] = [
  { precioListaCentavos: 123456, ajustePct: 0, descuentoLineaPct: 0, cantidad: 3, alicuota: 21 },
  { precioListaCentavos: 9999, ajustePct: 5, descuentoLineaPct: 10, cantidad: 2.5, alicuota: 10.5 },
  { precioListaCentavos: 55, ajustePct: -3, descuentoLineaPct: 0, cantidad: 7, alicuota: 0 },
];

describe('verificarTotalesVenta — payload honesto', () => {
  it('acepta lo que arma el POS (varias alícuotas, fracciones, descuento global)', () => {
    expect(() => verificarTotalesVenta(payloadComoElPos(CARRITO, 7.5))).not.toThrow();
  });

  it('acepta el payload con importes redondeados a 2 decimales (como en los tests de venta)', () => {
    const p = payloadComoElPos(CARRITO, 0);
    expect(() => verificarTotalesVenta({ ...p, importe_iva: Math.round(p.importe_iva * 100) / 100 })).not.toThrow();
  });

  it('acepta 300 carritos pseudoaleatorios armados con la fórmula del POS', () => {
    let seed = 20261020;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const alicuotas = [0, 10.5, 21, 27];
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rnd() * 5);
      const lineas: LineaPos[] = Array.from({ length: n }, () => ({
        precioListaCentavos: 1 + Math.floor(rnd() * 500000),
        ajustePct: Math.round((rnd() * 40 - 10) * 100) / 100,
        descuentoLineaPct: Math.round(rnd() * 30 * 100) / 100,
        cantidad: rnd() < 0.5 ? 1 + Math.floor(rnd() * 9) : Math.round((0.1 + rnd() * 9) * 1000) / 1000,
        alicuota: alicuotas[Math.floor(rnd() * alicuotas.length)]!,
      }));
      const dg = rnd() < 0.5 ? 0 : Math.round(rnd() * 25 * 100) / 100;
      expect(() => verificarTotalesVenta(payloadComoElPos(lineas, dg))).not.toThrow();
    }
  });
});

describe('verificarTotalesVenta — adulteraciones', () => {
  const base = () => payloadComoElPos(CARRITO, 7.5);

  it('rechaza un subtotal de línea que no es precio × cantidad', () => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, subtotal: p.lineas[0]!.subtotal - 100 };
    expect(() => verificarTotalesVenta(p)).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un subtotal general distinto de la suma de las líneas', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, subtotal: p.subtotal - 1 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un total distinto del subtotal con descuento global redondeado al peso', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, total: p.total - 500 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un total sin redondear (no múltiplo de $1) aunque el ajuste lo acompañe', () => {
    const p = payloadComoElPos([{ precioListaCentavos: 10050, ajustePct: 0, descuentoLineaPct: 0, cantidad: 1, alicuota: 21 }], 0);
    expect(() => verificarTotalesVenta({ ...p, total: 100.5, ajuste_redondeo: 0 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un ajuste de redondeo falso', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, ajuste_redondeo: p.ajuste_redondeo + 0.3 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un IVA que difiere en más de 1 centavo y tolera hasta 1', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, importe_iva: p.importe_iva + 0.5 })).toThrow('TOTALES_INCONSISTENTES');
    expect(() => verificarTotalesVenta({ ...p, importe_iva: p.importe_iva + 0.01 })).not.toThrow();
  });

  it('rechaza un descuento global que no coincide con el usado en el total', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, descuento_global: 0 })).toThrow('TOTALES_INCONSISTENTES');
  });
});

describe('verificarTotalesVenta — rangos', () => {
  const base = () => payloadComoElPos(CARRITO, 0);

  it.each([-1, 100.01, Number.NaN])('descuento_global %s → DESCUENTO_INVALIDO', (dg) => {
    expect(() => verificarTotalesVenta({ ...base(), descuento_global: dg })).toThrow('DESCUENTO_INVALIDO');
  });

  it.each([-5, 101, Number.NaN])('descuento_linea %s → DESCUENTO_INVALIDO', (d) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, descuento_linea: d };
    expect(() => verificarTotalesVenta(p)).toThrow('DESCUENTO_INVALIDO');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('cantidad %s → CANTIDAD_INVALIDA', (c) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, cantidad: c };
    expect(() => verificarTotalesVenta(p)).toThrow('CANTIDAD_INVALIDA');
  });

  it.each([-1, Number.NaN])('precio_unitario %s → PRECIO_INVALIDO', (pu) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, precio_unitario: pu };
    expect(() => verificarTotalesVenta(p)).toThrow('PRECIO_INVALIDO');
  });

  it.each([-1, Number.NaN])('alicuota_iva %s → TOTALES_INCONSISTENTES', (a) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, alicuota_iva: a };
    expect(() => verificarTotalesVenta(p)).toThrow('TOTALES_INCONSISTENTES');
  });
});
