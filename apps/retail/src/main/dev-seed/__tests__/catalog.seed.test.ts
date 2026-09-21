import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { seedCatalog } from '../catalog';
import * as schema from '../../db/schema';

function setupDb() {
  const db = createTestDb();
  runCatalogSeed(db); // IVA 21%
  return db;
}

describe('seedCatalog', () => {
  it('inserta impuestos extra, categorías, marcas, ubicaciones, productos, existencias y movimientos', () => {
    const db = setupDb();
    seedCatalog(db, false);

    const impuestos = db.select().from(schema.impuesto).all();
    expect(impuestos).toHaveLength(3); // IVA 21% + IVA 10.5% + Exento

    const categorias = db.select().from(schema.categoria).all();
    expect(categorias).toHaveLength(15); // 5 raíz + 10 hoja

    const marcas = db.select().from(schema.marca).all();
    expect(marcas).toHaveLength(6);

    const ubicaciones = db.select().from(schema.ubicacion).all();
    expect(ubicaciones).toHaveLength(18);

    const productos = db.select().from(schema.producto).all();
    expect(productos).toHaveLength(35);

    const existencias = db.select().from(schema.existencias).all();
    expect(existencias).toHaveLength(35);

    const movimientos = db.select().from(schema.movimiento_stock).all();
    expect(movimientos).toHaveLength(35);
  });

  it('stock edge cases: 3 sin stock, 5 bajo mínimo, 1 inactivo', () => {
    const db = setupDb();
    seedCatalog(db, false);

    const sinStock = db.select().from(schema.existencias)
      .all().filter(e => e.stock_fisico === 0);
    expect(sinStock).toHaveLength(3);

    const bajoMinimo = db.select().from(schema.existencias)
      .all().filter(e => e.stock_fisico > 0 && e.stock_fisico < e.stock_minimo);
    expect(bajoMinimo).toHaveLength(5);

    const inactivos = db.select().from(schema.producto)
      .all().filter(p => !p.activo);
    expect(inactivos).toHaveLength(1);
  });

  it('productos con factor_conversion = 12', () => {
    const db = setupDb();
    seedCatalog(db, false);

    const conFactor = db.select().from(schema.producto)
      .all().filter(p => p.factor_conversion === 12);
    expect(conFactor).toHaveLength(2);
  });

  it('idempotente: segunda llamada no duplica datos', () => {
    const db = setupDb();
    seedCatalog(db, false);
    seedCatalog(db, false); // segunda llamada

    const productos = db.select().from(schema.producto).all();
    expect(productos).toHaveLength(35);
  });

  it('force: borra y re-inserta', () => {
    const db = setupDb();
    seedCatalog(db, false);
    seedCatalog(db, true); // force

    const productos = db.select().from(schema.producto).all();
    expect(productos).toHaveLength(35);
  });
});
