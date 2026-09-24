import { describe, it, expect } from 'vitest';
import { escalarReceta } from './receta';

describe('escalarReceta', () => {
  it('escala cada ítem proporcionalmente a cantidadProducida/rinde', () => {
    // receta rinde 12kg con 6kg leche + 3kg crema; se producen 6kg (mitad)
    const items = [
      { articulo_id: 'leche', cantidad: 6 },
      { articulo_id: 'crema', cantidad: 3 },
    ];
    const r = escalarReceta(items, 6, 12);
    expect(r).toEqual([
      { articulo_id: 'leche', cantidad: 3 },
      { articulo_id: 'crema', cantidad: 1.5 },
    ]);
  });

  it('cantidadProducida = rinde no escala (factor 1)', () => {
    const items = [{ articulo_id: 'leche', cantidad: 6 }];
    expect(escalarReceta(items, 12, 12)).toEqual([{ articulo_id: 'leche', cantidad: 6 }]);
  });

  it('rinde inválido (0 o negativo) lanza', () => {
    expect(() => escalarReceta([{ articulo_id: 'leche', cantidad: 1 }], 5, 0)).toThrow('RINDE_INVALIDO');
  });
});
