import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { existenciasGetHandler, existenciasSetMinimosHandler } from '../existencias';

type Db = ReturnType<typeof setupDb>;
function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
}

describe('existencias handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('get retorna existencias con stock_disponible calculado', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const ex = existenciasGetHandler(db, { producto_id: p.id });
    expect(ex?.stock_fisico).toBe(0);
    expect(ex?.stock_disponible).toBe(0);
  });

  it('set-minimos actualiza stock_minimo y stock_maximo', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    existenciasSetMinimosHandler(db, { producto_id: p.id, stock_minimo: 5, stock_maximo: 50 });
    const ex = existenciasGetHandler(db, { producto_id: p.id });
    expect(ex?.stock_minimo).toBe(5);
    expect(ex?.stock_maximo).toBe(50);
  });
});
