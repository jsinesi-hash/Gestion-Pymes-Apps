import { describe, it, expect } from 'vitest';
import { costoDeLote } from './costo';

describe('costoDeLote', () => {
  it('costo unitario = promedio ponderado de los insumos consumidos', () => {
    // 3kg leche a $100 + 1kg crema a $400 → consumido $700, producido 2kg → $350/kg
    const consumos = [
      { cantidad: 3, costoPromedioCentavos: 10000 },
      { cantidad: 1, costoPromedioCentavos: 40000 },
    ];
    expect(costoDeLote(consumos, 2)).toBe(35000);
  });

  it('cantidadProducida <= 0 lanza', () => {
    expect(() => costoDeLote([{ cantidad: 1, costoPromedioCentavos: 100 }], 0)).toThrow('CANTIDAD_PRODUCIDA_INVALIDA');
  });
});
