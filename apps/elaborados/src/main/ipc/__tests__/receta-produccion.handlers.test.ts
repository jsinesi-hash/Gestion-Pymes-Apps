import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../articulo';
import { recetaProduccionGetHandler, recetaProduccionSetHandler } from '../receta-produccion';

type Db = ReturnType<typeof setupDb>;

describe('receta-produccion handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('get devuelve null si el artículo no tiene receta', () => {
    loginAsAdmin(db);
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    expect(recetaProduccionGetHandler(db, { articulo_id: choco.id })).toBeNull();
  });

  it('set crea la receta con sus ítems', () => {
    loginAsAdmin(db);
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    const cacao = articuloCreateHandler(db, { nombre: 'Cacao', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });

    recetaProduccionSetHandler(db, {
      articulo_id: choco.id,
      rinde_cantidad: 12,
      items: [
        { articulo_id: leche.id, cantidad: 10 },
        { articulo_id: cacao.id, cantidad: 2 },
      ],
    });

    const receta = recetaProduccionGetHandler(db, { articulo_id: choco.id });
    expect(receta?.rinde_cantidad).toBe(12);
    expect(receta?.items).toHaveLength(2);
  });

  it('set sobre un artículo que no es "elaborado" lanza ARTICULO_NO_ELABORADO', () => {
    loginAsAdmin(db);
    const reventa = articuloCreateHandler(db, { nombre: 'Palito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
    expect(() => recetaProduccionSetHandler(db, {
      articulo_id: reventa.id, rinde_cantidad: 1, items: [{ articulo_id: reventa.id, cantidad: 1 }],
    })).toThrow('ARTICULO_NO_ELABORADO');
  });

  it('set reemplaza los ítems existentes (no los acumula)', () => {
    loginAsAdmin(db);
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    recetaProduccionSetHandler(db, { articulo_id: choco.id, rinde_cantidad: 10, items: [{ articulo_id: leche.id, cantidad: 5 }] });
    recetaProduccionSetHandler(db, { articulo_id: choco.id, rinde_cantidad: 12, items: [{ articulo_id: leche.id, cantidad: 6 }] });
    const receta = recetaProduccionGetHandler(db, { articulo_id: choco.id });
    expect(receta?.rinde_cantidad).toBe(12);
    expect(receta?.items).toHaveLength(1);
    expect(receta?.items[0].cantidad).toBe(6);
  });
});
