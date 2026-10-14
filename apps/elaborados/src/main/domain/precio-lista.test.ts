import { describe, it, expect } from 'vitest';
import { precioParaLista } from './precio-lista';

describe('precioParaLista', () => {
  it('el precio absoluto de la lista pisa al base y al ajuste', () => {
    expect(precioParaLista(150000, 120000, 50)).toBe(120000);
  });
  it('un precio absoluto 0 es válido (no cae al respaldo)', () => {
    expect(precioParaLista(150000, 0, 10)).toBe(0);
  });
  it('sin precio absoluto aplica el ajuste % sobre el base, redondeado al centavo', () => {
    expect(precioParaLista(150000, null, -10)).toBe(135000);
    expect(precioParaLista(1001, null, 10)).toBe(1101); // 1101.1 → 1101
    expect(precioParaLista(999, null, 15)).toBe(1149); // 1148.85 → 1149
  });
  it('ajuste 0 devuelve el base', () => {
    expect(precioParaLista(150000, null, 0)).toBe(150000);
  });
  it('nunca devuelve negativo', () => {
    expect(precioParaLista(1000, null, -150)).toBe(0);
  });
});
