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
  // ADR-157: el POS manda centavos; el IVA, redondeado al centavo.
  const lp = lineas.map((l, i) => ({
    cantidad: l.cantidad,
    precio_unitario_centavos: r.lineas[i]!.precioUnitarioCentavos,
    descuento_linea: l.descuentoLineaPct,
    alicuota_iva: l.alicuota,
    subtotal_centavos: r.lineas[i]!.subtotalCentavos,
  }));
  const importe_iva_centavos = Math.round(lp.reduce((s, l) => s + l.subtotal_centavos * l.alicuota_iva / (100 + l.alicuota_iva), 0));
  return {
    lineas: lp,
    descuento_global: descuentoGlobalPct,
    subtotal_centavos: r.subtotalCentavos,
    importe_iva_centavos,
    total_centavos: red.totalCentavos,
    ajuste_redondeo_centavos: red.ajusteRedondeoCentavos,
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

  it('rechaza importes con fracción de centavo (deben ser enteros)', () => {
    const p = payloadComoElPos(CARRITO, 0);
    expect(() => verificarTotalesVenta({ ...p, importe_iva_centavos: p.importe_iva_centavos + 0.5 })).toThrow('TOTALES_INCONSISTENTES');
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
    p.lineas[0] = { ...p.lineas[0]!, subtotal_centavos: p.lineas[0]!.subtotal_centavos - 10000 };
    expect(() => verificarTotalesVenta(p)).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un subtotal general distinto de la suma de las líneas', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, subtotal_centavos: p.subtotal_centavos - 1 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un total distinto del subtotal con descuento global redondeado al peso', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, total_centavos: p.total_centavos - 50000 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un total sin redondear (no múltiplo de $1) aunque el ajuste lo acompañe', () => {
    const p = payloadComoElPos([{ precioListaCentavos: 10050, ajustePct: 0, descuentoLineaPct: 0, cantidad: 1, alicuota: 21 }], 0);
    expect(() => verificarTotalesVenta({ ...p, total_centavos: 10050, ajuste_redondeo_centavos: 0 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un ajuste de redondeo falso', () => {
    const p = base();
    expect(() => verificarTotalesVenta({ ...p, ajuste_redondeo_centavos: p.ajuste_redondeo_centavos + 30 })).toThrow('TOTALES_INCONSISTENTES');
  });

  it('rechaza un IVA que difiere en 2 centavos o más; el redondeo al centavo se acepta', () => {
    const p = base();
    expect(() => verificarTotalesVenta(p)).not.toThrow();
    expect(() => verificarTotalesVenta({ ...p, importe_iva_centavos: p.importe_iva_centavos + 2 })).toThrow('TOTALES_INCONSISTENTES');
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

  it.each([-1, Number.NaN, 12.5])('precio_unitario_centavos %s → PRECIO_INVALIDO', (pu) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, precio_unitario_centavos: pu };
    expect(() => verificarTotalesVenta(p)).toThrow('PRECIO_INVALIDO');
  });

  it.each([-1, Number.NaN])('alicuota_iva %s → TOTALES_INCONSISTENTES', (a) => {
    const p = base();
    p.lineas[0] = { ...p.lineas[0]!, alicuota_iva: a };
    expect(() => verificarTotalesVenta(p)).toThrow('TOTALES_INCONSISTENTES');
  });
});
