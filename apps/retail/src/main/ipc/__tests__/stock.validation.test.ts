import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler, stockAjusteHandler, stockMermaHandler } from '../stock';

type Db = ReturnType<typeof setupDb>;
function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
}

describe('stock validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('entrada rechaza cantidad no numérica', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockEntradaHandler(db, { producto_id: 'x', cantidad: 'mucho' } as any))
      .toThrow(/VALIDATION:cantidad:TIPO/);
  });

  it('entrada rechaza producto_id de tipo equivocado', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockEntradaHandler(db, { producto_id: 123, cantidad: 5 } as any))
      .toThrow(/VALIDATION:producto_id:TIPO/);
  });

  it('entrada rechaza costo_unitario no numérico si está presente', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockEntradaHandler(db, { producto_id: 'x', cantidad: 5, costo_unitario: 'caro' } as any))
      .toThrow(/VALIDATION:costo_unitario:TIPO/);
  });

  it('entrada preserva guard CANTIDAD_INVALIDA para cantidad <= 0', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockEntradaHandler(db, { producto_id: 'x', cantidad: 0 } as any))
      .toThrow(/CANTIDAD_INVALIDA/);
  });

  it('entrada happy path intacto', () => {
    const db = setupDb(); loginAsAdmin(db);
    const p = createTestProduct(db);
    const mov = stockEntradaHandler(db, { producto_id: p.id, cantidad: 10, costo_unitario: 500 } as any);
    expect(mov.cantidad).toBe(10);
    expect(mov.stock_resultante).toBe(10);
  });

  it('ajuste rechaza cantidad_contada no numérica', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockAjusteHandler(db, { producto_id: 'x', cantidad_contada: 'diez', observaciones: 'ok' } as any))
      .toThrow(/VALIDATION:cantidad_contada:TIPO/);
  });

  it('ajuste rechaza observaciones vacía con VALIDATION:observaciones:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockAjusteHandler(db, { producto_id: 'x', cantidad_contada: 5, observaciones: '  ' } as any))
      .toThrow(/VALIDATION:observaciones:REQUERIDO/);
  });

  it('ajuste happy path intacto', () => {
    const db = setupDb(); loginAsAdmin(db);
    const p = createTestProduct(db);
    const mov = stockAjusteHandler(db, { producto_id: p.id, cantidad_contada: 7, observaciones: 'conteo' } as any);
    expect(mov.stock_resultante).toBe(7);
  });

  it('merma rechaza cantidad no numérica', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockMermaHandler(db, { producto_id: 'x', cantidad: 'poco', observaciones: 'rotura' } as any))
      .toThrow(/VALIDATION:cantidad:TIPO/);
  });

  it('merma rechaza observaciones vacía con VALIDATION:observaciones:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => stockMermaHandler(db, { producto_id: 'x', cantidad: 1, observaciones: '' } as any))
      .toThrow(/VALIDATION:observaciones:REQUERIDO/);
  });

  it('merma preserva guard STOCK_INSUFICIENTE', () => {
    const db = setupDb(); loginAsAdmin(db);
    const p = createTestProduct(db);
    expect(() => stockMermaHandler(db, { producto_id: p.id, cantidad: 5, observaciones: 'rotura' } as any))
      .toThrow(/STOCK_INSUFICIENTE/);
  });
});
