import { describe, it, expect } from 'vitest';
import { ivaPorAlicuota, type ItemComprobante } from './comprobante';

const item = (subtotalCentavos: number, alicuotaIva: number): ItemComprobante => ({
  descripcion: 'x', cantidad: 1, precioUnitarioCentavos: subtotalCentavos, subtotalCentavos, alicuotaIva,
});

describe('ivaPorAlicuota', () => {
  it('una alícuota: neto + IVA = bruto', () => {
    const r = ivaPorAlicuota([item(12100, 21)], 0);
    expect(r).toEqual([{ alicuota: 21, netoCentavos: 10000, ivaCentavos: 2100 }]);
  });

  it('agrupa por alícuota y ordena de menor a mayor', () => {
    const r = ivaPorAlicuota([item(12100, 21), item(11050, 10.5), item(12100, 21)], 0);
    expect(r.map((g) => g.alicuota)).toEqual([10.5, 21]);
    expect(r[1]).toEqual({ alicuota: 21, netoCentavos: 20000, ivaCentavos: 4200 });
    expect(r[0].netoCentavos + r[0].ivaCentavos).toBe(11050);
  });

  it('prorratea el descuento global antes de discriminar', () => {
    // 20000 bruto − 10% (2000) = 18000 → IVA 21% = 18000 × 21 / 121 = 3123.97 → 3124
    const r = ivaPorAlicuota([item(20000, 21)], 2000);
    expect(r).toEqual([{ alicuota: 21, netoCentavos: 14876, ivaCentavos: 3124 }]);
  });

  it('exento (0%) no tiene IVA; sin ítems devuelve []', () => {
    expect(ivaPorAlicuota([item(5000, 0)], 0)).toEqual([{ alicuota: 0, netoCentavos: 5000, ivaCentavos: 0 }]);
    expect(ivaPorAlicuota([], 0)).toEqual([]);
  });

  it('descuento del 100% no produce NaN', () => {
    const r = ivaPorAlicuota([item(10000, 21)], 10000);
    expect(r).toEqual([{ alicuota: 21, netoCentavos: 0, ivaCentavos: 0 }]);
  });
});
