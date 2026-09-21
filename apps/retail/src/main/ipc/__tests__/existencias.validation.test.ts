import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { existenciasSetMinimosHandler, existenciasGetHandler } from '../existencias';

type Db = ReturnType<typeof setupDb>;
function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
}

describe('existencias validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('set-minimos rechaza stock_minimo no numérico', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => existenciasSetMinimosHandler(db, { producto_id: 'x', stock_minimo: 'cinco' } as any))
      .toThrow(/VALIDATION:stock_minimo:TIPO/);
  });

  it('set-minimos rechaza producto_id de tipo equivocado', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => existenciasSetMinimosHandler(db, { producto_id: 5, stock_minimo: 3 } as any))
      .toThrow(/VALIDATION:producto_id:TIPO/);
  });

  it('set-minimos rechaza stock_maximo no numérico si está presente', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => existenciasSetMinimosHandler(db, { producto_id: 'x', stock_minimo: 3, stock_maximo: 'mucho' } as any))
      .toThrow(/VALIDATION:stock_maximo:TIPO/);
  });

  it('set-minimos happy path intacto (minimo + maximo)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const p = createTestProduct(db);
    existenciasSetMinimosHandler(db, { producto_id: p.id, stock_minimo: 5, stock_maximo: 50 } as any);
    const ex = existenciasGetHandler(db, { producto_id: p.id });
    expect(ex?.stock_minimo).toBe(5);
    expect(ex?.stock_maximo).toBe(50);
  });

  it('set-minimos happy path sin stock_maximo (queda null)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const p = createTestProduct(db);
    existenciasSetMinimosHandler(db, { producto_id: p.id, stock_minimo: 8 } as any);
    const ex = existenciasGetHandler(db, { producto_id: p.id });
    expect(ex?.stock_minimo).toBe(8);
    expect(ex?.stock_maximo).toBeNull();
  });
});
