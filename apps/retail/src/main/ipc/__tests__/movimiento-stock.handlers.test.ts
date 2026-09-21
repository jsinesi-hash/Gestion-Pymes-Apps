import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { movimientoStockListHandler, movimientoStockCreateHandler } from '../movimiento-stock';

type Db = ReturnType<typeof setupDb>;
function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
}

describe('movimiento-stock handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('list incluye movimiento inicial', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const movs = movimientoStockListHandler(db, { producto_id: p.id });
    expect(movs).toHaveLength(1);
    expect(movs[0].motivo).toBe('inicial');
  });

  it('create ajuste actualiza stock en existencias', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    movimientoStockCreateHandler(db, { producto_id: p.id, tipo: 'ajuste', motivo: 'ajuste_conteo', cantidad: 10 });
    const movs = movimientoStockListHandler(db, { producto_id: p.id });
    expect(movs).toHaveLength(2);
    const ajuste = movs.find(m => m.motivo === 'ajuste_conteo')!;
    expect(ajuste.stock_resultante).toBe(10);
  });
});
