import { describe, it, expect } from 'vitest';
import { calcularConsumo, validarStock } from './consumo';

describe('calcularConsumo', () => {
  it('componentes fijos se multiplican por la cantidad de la línea', () => {
    const r = calcularConsumo(2, [{ articulo_id: 'pote14', cantidad: 1 }], []);
    expect(r).toEqual([{ articulo_id: 'pote14', cantidad: 2 }]);
  });

  it('modo reparto: cantidad_total dividida en partes iguales entre las opciones elegidas', () => {
    const r = calcularConsumo(1, [], [{
      modo_descuento: 'reparto', cantidad_total: 0.25,
      opciones_elegidas: [{ articulo_id: 'choco', cantidad: 0 }, { articulo_id: 'frutilla', cantidad: 0 }],
    }]);
    expect(r).toEqual([
      { articulo_id: 'choco', cantidad: 0.125 },
      { articulo_id: 'frutilla', cantidad: 0.125 },
    ]);
  });

  it('modo por_opcion: cada opción consume su propia cantidad (toppings)', () => {
    const r = calcularConsumo(1, [], [{
      modo_descuento: 'por_opcion', cantidad_total: 0,
      opciones_elegidas: [{ articulo_id: 'granizado', cantidad: 0.05 }],
    }]);
    expect(r).toEqual([{ articulo_id: 'granizado', cantidad: 0.05 }]);
  });

  it('modo sin_descuento: no genera consumo', () => {
    const r = calcularConsumo(1, [], [{
      modo_descuento: 'sin_descuento', cantidad_total: 0,
      opciones_elegidas: [{ articulo_id: 'choco', cantidad: 0 }],
    }]);
    expect(r).toEqual([]);
  });

  it('componentes fijos + grupo se combinan, todo escalado por cantidad de línea', () => {
    const r = calcularConsumo(3, [{ articulo_id: 'vasito', cantidad: 1 }], [{
      modo_descuento: 'reparto', cantidad_total: 0.2,
      opciones_elegidas: [{ articulo_id: 'choco', cantidad: 0 }],
    }]);
    expect(r).toEqual([
      { articulo_id: 'vasito', cantidad: 3 },
      { articulo_id: 'choco', cantidad: 0.6 },
    ]);
  });
});

describe('validarStock', () => {
  it('artículo que bloquea sin stock y queda negativo: no ok, bloquea', () => {
    const r = validarStock(
      [{ articulo_id: 'cucurucho', cantidad: 5 }],
      new Map([['cucurucho', { stock: 3, bloquea_sin_stock: true }]]),
    );
    expect(r).toEqual([{ articulo_id: 'cucurucho', ok: false, bloquea: true, stockResultante: -2 }]);
  });

  it('artículo que NO bloquea y queda negativo: ok con advertencia (no bloquea)', () => {
    const r = validarStock(
      [{ articulo_id: 'choco', cantidad: 5 }],
      new Map([['choco', { stock: 3, bloquea_sin_stock: false }]]),
    );
    expect(r).toEqual([{ articulo_id: 'choco', ok: true, bloquea: false, stockResultante: -2 }]);
  });

  it('stock suficiente: ok, no bloquea', () => {
    const r = validarStock(
      [{ articulo_id: 'vasito', cantidad: 1 }],
      new Map([['vasito', { stock: 10, bloquea_sin_stock: true }]]),
    );
    expect(r).toEqual([{ articulo_id: 'vasito', ok: true, bloquea: false, stockResultante: 9 }]);
  });
});
