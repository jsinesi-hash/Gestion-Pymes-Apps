import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import * as schema from '../../db/schema';
import {
  demoCatalogEstadoHandler,
  demoCatalogCargarHandler,
  demoCatalogVaciarHandler,
} from '../demo-catalog';
import { productoCreateHandler } from '../producto';

// El seeder demo necesita el catálogo base (IVA/categorías/marcas/unidades).
function setup() {
  const db = setupDb();          // migraciones + runSeed (auth)
  runCatalogSeed(db);            // IVA/categorías/marcas/unidades
  loginAsAdmin(db);             // sesión Supervisor (tiene usuario.administrar)
  return db;
}

describe('demo-catalog handlers (ADR-062)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setup(); });
  afterEach(() => { clearSession(); });

  it('estado inicial: sin productos ni demo', () => {
    const estado = demoCatalogEstadoHandler(db);
    expect(estado.totalProductos).toBe(0);
    expect(estado.productosDemo).toBe(0);
    expect(estado.hayProductos).toBe(false);
    expect(estado.hayDemo).toBe(false);
  });

  it('cargar siembra los 15 productos demo con lista predeterminada y precios', () => {
    const res = demoCatalogCargarHandler(db);
    expect(res.yaHabiaProductos).toBe(false);
    expect(res.sembrados).toBe(15);
    expect(res.estado.totalProductos).toBe(15);
    expect(res.estado.hayDemo).toBe(true);

    const listaDef = db.select().from(schema.lista_precio)
      .where(eq(schema.lista_precio.predeterminada, true)).all();
    expect(listaDef.length).toBe(1);
    expect(db.select().from(schema.lista_precio_valor).all().length).toBe(15);
  });

  it('cargar es idempotente / no siembra si ya hay productos', () => {
    demoCatalogCargarHandler(db);
    const segunda = demoCatalogCargarHandler(db);
    expect(segunda.yaHabiaProductos).toBe(true);
    expect(segunda.sembrados).toBe(0);
    expect(db.select().from(schema.producto).all().length).toBe(15);
  });

  it('vaciar elimina los 15 productos demo pero conserva la lista "General"', () => {
    demoCatalogCargarHandler(db);
    const res = demoCatalogVaciarHandler(db);
    expect(res.eliminados).toBe(15);
    expect(res.estado.totalProductos).toBe(0);
    expect(res.estado.hayDemo).toBe(false);

    // La lista predeterminada queda (útil para el catálogo real).
    expect(db.select().from(schema.lista_precio).all().length).toBe(1);
    // Sin filas huérfanas en tablas dependientes.
    expect(db.select().from(schema.existencias).all().length).toBe(0);
    expect(db.select().from(schema.movimiento_stock).all().length).toBe(0);
    expect(db.select().from(schema.lista_precio_valor).all().length).toBe(0);
    expect(db.select().from(schema.producto_presentacion).all().length).toBe(0);
  });

  it('vaciar NO toca productos reales cargados por el comerciante', () => {
    demoCatalogCargarHandler(db);
    // Producto real por el camino normal (movimiento inicial referencia_tipo 'sistema').
    const cat = db.select().from(schema.categoria).all()[0];
    const iva = db.select().from(schema.impuesto)
      .where(eq(schema.impuesto.predeterminado, true)).get()!;
    const real = productoCreateHandler(db, {
      nombre_corto: 'Producto real',
      categoria_id: cat.id,
      unidad_venta: 'unidad',
      impuesto_id: iva.id,
      precio_venta_lista: 999,
    });

    const res = demoCatalogVaciarHandler(db);
    expect(res.eliminados).toBe(15);

    const quedan = db.select().from(schema.producto).all();
    expect(quedan.length).toBe(1);
    expect(quedan[0].id).toBe(real.id);
  });

  it('vaciar sin datos demo devuelve 0', () => {
    const res = demoCatalogVaciarHandler(db);
    expect(res.eliminados).toBe(0);
  });

  it('exige sesión de Supervisor (usuario.administrar)', () => {
    clearSession();
    expect(() => demoCatalogCargarHandler(db)).toThrow('UNAUTHENTICATED');
    expect(() => demoCatalogVaciarHandler(db)).toThrow('UNAUTHENTICATED');
    expect(() => demoCatalogEstadoHandler(db)).toThrow('UNAUTHENTICATED');
  });
});
