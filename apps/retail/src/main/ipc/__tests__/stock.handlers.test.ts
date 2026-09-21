import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler, stockAjusteHandler, stockMermaHandler } from '../stock';
import { eq } from 'drizzle-orm';
import { existencias, producto } from '../../db/schema/catalog';

type Db = ReturnType<typeof setupDb>;

function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, {
    nombre_corto: 'P',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: 100,
  });
}

describe('stockEntradaHandler', () => {
  let db: Db;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  function getExistencias(productoId: string) {
    return db.select().from(existencias).where(eq(existencias.producto_id, productoId)).get()!;
  }

  function getProducto(productoId: string) {
    return db.select().from(producto).where(eq(producto.id, productoId)).get()!;
  }

  it('suma cantidad al stock fisico', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const ex = getExistencias(p.id);
    const stockAntes = ex.stock_fisico;

    stockEntradaHandler(db, { producto_id: p.id, cantidad: 10 });

    const exDespues = getExistencias(p.id);
    expect(exDespues.stock_fisico).toBe(stockAntes + 10);
  });

  it('guarda stock_resultante correcto en el movimiento', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const ex = getExistencias(p.id);
    const stockAntes = ex.stock_fisico;

    const mov = stockEntradaHandler(db, { producto_id: p.id, cantidad: 5 });

    expect(mov.stock_resultante).toBe(stockAntes + 5);
    expect(mov.motivo).toBe('entrada_manual');
    expect(mov.tipo).toBe('entrada');
    expect(mov.cantidad).toBe(5);
  });

  it('sin costo_unitario el CPP no cambia', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const prod = getProducto(p.id);
    const cppAntes = prod.precio_costo_promedio;

    stockEntradaHandler(db, { producto_id: p.id, cantidad: 10 });

    const prodDespues = getProducto(p.id);
    expect(prodDespues.precio_costo_promedio).toBe(cppAntes);
  });

  it('con costo_unitario recalcula CPP correctamente', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 10 })
      .where(eq(existencias.producto_id, p.id))
      .run();
    db.update(producto)
      .set({ precio_costo_promedio: 100 })
      .where(eq(producto.id, p.id))
      .run();

    stockEntradaHandler(db, { producto_id: p.id, cantidad: 5, costo_unitario: 130 });

    const prodDespues = getProducto(p.id);
    // nuevo_cpp = (10*100 + 5*130) / 15 = (1000 + 650) / 15 = 110
    expect(prodDespues.precio_costo_promedio).toBeCloseTo(110, 5);
  });

  it('multiples entradas acumulan CPP correctamente', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias).set({ stock_fisico: 0 }).where(eq(existencias.producto_id, p.id)).run();
    db.update(producto).set({ precio_costo_promedio: 0 }).where(eq(producto.id, p.id)).run();

    stockEntradaHandler(db, { producto_id: p.id, cantidad: 10, costo_unitario: 100 });
    stockEntradaHandler(db, { producto_id: p.id, cantidad: 10, costo_unitario: 120 });
    stockEntradaHandler(db, { producto_id: p.id, cantidad: 10, costo_unitario: 110 });

    const prodFinal = getProducto(p.id);
    // cpp1 = (0+10*100)/10 = 100
    // cpp2 = (10*100+10*120)/20 = 110
    // cpp3 = (20*110+10*110)/30 = 110
    expect(prodFinal.precio_costo_promedio).toBeCloseTo(110, 5);
  });

  it('lanza UNAUTHENTICATED sin sesion activa', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    clearSession();
    expect(() => stockEntradaHandler(db, { producto_id: p.id, cantidad: 5 }))
      .toThrow('UNAUTHENTICATED');
  });

  it('lanza NOT_FOUND con producto inexistente', () => {
    loginAsAdmin(db);
    expect(() =>
      stockEntradaHandler(db, { producto_id: '00000000-0000-0000-0000-000000000000', cantidad: 5 })
    ).toThrow('NOT_FOUND');
  });

  it('lanza CANTIDAD_INVALIDA si cantidad es cero o negativa', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    expect(() => stockEntradaHandler(db, { producto_id: p.id, cantidad: 0 }))
      .toThrow('CANTIDAD_INVALIDA');
    expect(() => stockEntradaHandler(db, { producto_id: p.id, cantidad: -1 }))
      .toThrow('CANTIDAD_INVALIDA');
  });
});

describe('stockAjusteHandler', () => {
  let db: Db;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  function getExistencias(productoId: string) {
    return db.select().from(existencias).where(eq(existencias.producto_id, productoId)).get()!;
  }

  it('conteo mayor al stock: delta positivo, stock_resultante = cantidad_contada', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 10 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    const mov = stockAjusteHandler(db, {
      producto_id: p.id,
      cantidad_contada: 15,
      observaciones: 'conteo físico mensual',
    });

    expect(mov.stock_resultante).toBe(15);
    expect(mov.cantidad).toBe(5);
    expect(mov.tipo).toBe('ajuste');
    expect(mov.motivo).toBe('ajuste_conteo');

    const ex = getExistencias(p.id);
    expect(ex.stock_fisico).toBe(15);
  });

  it('conteo menor al stock: delta negativo, stock_resultante = cantidad_contada', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 10 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    const mov = stockAjusteHandler(db, {
      producto_id: p.id,
      cantidad_contada: 7,
      observaciones: 'diferencia detectada',
    });

    expect(mov.stock_resultante).toBe(7);
    expect(mov.cantidad).toBe(-3);

    const ex = getExistencias(p.id);
    expect(ex.stock_fisico).toBe(7);
  });

  it('conteo igual al stock: lanza NO_CHANGE', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const ex = getExistencias(p.id);
    const stockActual = ex.stock_fisico;

    expect(() =>
      stockAjusteHandler(db, {
        producto_id: p.id,
        cantidad_contada: stockActual,
        observaciones: 'sin diferencia',
      })
    ).toThrow('NO_CHANGE');
  });

  it('observaciones vacias: lanza VALIDATION:observaciones:REQUERIDO', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);

    expect(() =>
      stockAjusteHandler(db, {
        producto_id: p.id,
        cantidad_contada: 99,
        observaciones: '',
      })
    ).toThrow('VALIDATION:observaciones:REQUERIDO');
  });
});

describe('stockMermaHandler', () => {
  let db: Db;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  function getExistencias(productoId: string) {
    return db.select().from(existencias).where(eq(existencias.producto_id, productoId)).get()!;
  }

  it('resta cantidad al stock, stock_resultante = stock_ant - cantidad', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 20 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    const mov = stockMermaHandler(db, {
      producto_id: p.id,
      cantidad: 3,
      observaciones: 'producto roto',
    });

    expect(mov.stock_resultante).toBe(17);
    expect(mov.tipo).toBe('salida');
    expect(mov.motivo).toBe('merma_rotura');

    const ex = getExistencias(p.id);
    expect(ex.stock_fisico).toBe(17);
  });

  it('la cantidad almacenada en el movimiento es negativa', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 20 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    const mov = stockMermaHandler(db, {
      producto_id: p.id,
      cantidad: 4,
      observaciones: 'deterioro',
    });

    expect(mov.cantidad).toBe(-4);
  });

  it('cantidad mayor al stock: lanza STOCK_INSUFICIENTE', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 5 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    expect(() =>
      stockMermaHandler(db, {
        producto_id: p.id,
        cantidad: 10,
        observaciones: 'error de carga',
      })
    ).toThrow('STOCK_INSUFICIENTE');
  });

  it('observaciones vacias: lanza VALIDATION:observaciones:REQUERIDO', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);

    expect(() =>
      stockMermaHandler(db, {
        producto_id: p.id,
        cantidad: 1,
        observaciones: '   ',
      })
    ).toThrow('VALIDATION:observaciones:REQUERIDO');
  });
});

describe('Invariante: Σ cantidad = stock_fisico', () => {
  let db: Db;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  it('la suma de todos los movimientos iguala el stock_fisico actual', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    db.update(existencias)
      .set({ stock_fisico: 0 })
      .where(eq(existencias.producto_id, p.id))
      .run();

    stockEntradaHandler(db, { producto_id: p.id, cantidad: 20, costo_unitario: 100 });
    stockMermaHandler(db, { producto_id: p.id, cantidad: 3, observaciones: 'roto' });
    stockAjusteHandler(db, { producto_id: p.id, cantidad_contada: 15, observaciones: 'conteo' });

    const movimientos = db
      .select()
      .from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, p.id))
      .all();

    const sum = movimientos.reduce((acc, m) => acc + m.cantidad, 0);
    const ex = db.select().from(existencias).where(eq(existencias.producto_id, p.id)).get()!;

    expect(sum).toBeCloseTo(ex.stock_fisico, 5);
  });
});
