import { describe, it, expect } from 'vitest';
import { carritoReducer, carritoInicial, aPayload } from './carritoReducer';
import type { ProductoPos } from './tipos';

const pote: ProductoPos = {
  id: 'p-pote', nombre: 'Pote 1/4', categoria_venta_id: 'c1', precio_centavos: 150000,
  grupos: [{ grupo_modificador_id: 'g1', nombre: 'Sabores', min: 1, max: 3, cantidad_total: 0.25, modo_descuento: 'reparto',
    opciones: [{ id: 'o-choco', nombre: 'Chocolate', recargo_centavos: 0 }, { id: 'o-ddl', nombre: 'DDL', recargo_centavos: 20000 }] }],
};
const palito: ProductoPos = { id: 'p-palito', nombre: 'Palito', categoria_venta_id: 'c1', precio_centavos: 100000, grupos: [] };

describe('carritoReducer', () => {
  it('agrega una línea con su detalle de sabores', () => {
    const s = carritoReducer(carritoInicial, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco', 'o-ddl'] }] });
    expect(s.lineas).toHaveLength(1);
    expect(s.lineas[0]).toMatchObject({ producto_venta_id: 'p-pote', nombre: 'Pote 1/4', detalle: 'Chocolate, DDL', cantidad: 1, descuento_linea_pct: 0 });
  });

  it('agregar el mismo producto con los mismos sabores suma cantidad (sin importar el orden de las opciones)', () => {
    let s = carritoReducer(carritoInicial, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco', 'o-ddl'] }] });
    s = carritoReducer(s, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-ddl', 'o-choco'] }] });
    expect(s.lineas).toHaveLength(1);
    expect(s.lineas[0].cantidad).toBe(2);
  });

  it('sabores distintos o producto distinto crean líneas separadas', () => {
    let s = carritoReducer(carritoInicial, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco'] }] });
    s = carritoReducer(s, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-ddl'] }] });
    s = carritoReducer(s, { tipo: 'agregar', producto: palito, modificadores: [] });
    expect(s.lineas).toHaveLength(3);
    expect(new Set(s.lineas.map((l) => l.key)).size).toBe(3);
  });

  it('cambia cantidad (mínimo 1), quita líneas y fija descuentos acotados 0-100', () => {
    let s = carritoReducer(carritoInicial, { tipo: 'agregar', producto: palito, modificadores: [] });
    const key = s.lineas[0].key;
    s = carritoReducer(s, { tipo: 'cantidad', key, cantidad: 5 });
    expect(s.lineas[0].cantidad).toBe(5);
    s = carritoReducer(s, { tipo: 'cantidad', key, cantidad: 0 });
    expect(s.lineas[0].cantidad).toBe(1);
    s = carritoReducer(s, { tipo: 'descuentoLinea', key, pct: 150 });
    expect(s.lineas[0].descuento_linea_pct).toBe(100);
    s = carritoReducer(s, { tipo: 'descuentoGlobal', pct: -5 });
    expect(s.descuentoGlobalPct).toBe(0);
    s = carritoReducer(s, { tipo: 'quitar', key });
    expect(s.lineas).toEqual([]);
  });

  it('limpiar vuelve al estado inicial y aPayload no incluye precios', () => {
    let s = carritoReducer(carritoInicial, { tipo: 'agregar', producto: pote, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco'] }] });
    s = carritoReducer(s, { tipo: 'descuentoGlobal', pct: 10 });
    expect(aPayload(s)).toEqual({
      lineas: [{ producto_venta_id: 'p-pote', cantidad: 1, descuento_linea_pct: 0, modificadores: [{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco'] }] }],
      descuento_global_pct: 10,
    });
    expect(carritoReducer(s, { tipo: 'limpiar' })).toEqual(carritoInicial);
  });
});
