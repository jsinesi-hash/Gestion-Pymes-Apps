import { describe, it, expect } from 'vitest';
import { costoPromedioEntrada } from './costo';

describe('costoPromedioEntrada', () => {
  it('con stock previo positivo, pondera por cantidad', () => {
    // 10 kg a $100 + 10 kg a $200 → 20 kg a $150 (centavos: 10000/20000 → 15000)
    expect(costoPromedioEntrada(10, 10000, 10, 20000)).toBe(15000);
  });

  it('con stock previo en 0, el costo nuevo = costo que entra', () => {
    expect(costoPromedioEntrada(0, 99999, 5, 12000)).toBe(12000);
  });

  it('con stock previo negativo, el costo nuevo = costo que entra (no promedia negativo)', () => {
    expect(costoPromedioEntrada(-3, 8000, 5, 12000)).toBe(12000);
  });

  it('redondea al centavo entero', () => {
    expect(costoPromedioEntrada(3, 10000, 1, 10001)).toBe(Math.round((3 * 10000 + 1 * 10001) / 4));
  });
});
