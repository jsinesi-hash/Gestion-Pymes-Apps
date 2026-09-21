import { describe, it, expect } from 'vitest';
import { eq, and, isNull } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { runCatalogSeed } from '../../catalog/seed';
import { runDemoCatalogSeed, DEMO_PRODUCTOS } from '../demo-catalog';

// Demo seeder necesita IVA/categorías/marcas/unidades → runCatalogSeed primero.
function setupCatalogDb() {
  const db = createTestDb();
  runCatalogSeed(db);
  return db;
}

describe('runDemoCatalogSeed', () => {
  it('siembra una lista_precio predeterminada y activa (no existe de fábrica)', () => {
    const db = setupCatalogDb();
    // Precondición: no hay lista de precios de fábrica.
    expect(db.select().from(schema.lista_precio).all().length).toBe(0);

    runDemoCatalogSeed(db);

    const listas = db.select().from(schema.lista_precio)
      .where(and(eq(schema.lista_precio.predeterminada, true), eq(schema.lista_precio.activo, true)))
      .all();
    expect(listas.length).toBe(1);
  });

  it('siembra 15 productos', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    const productos = db.select().from(schema.producto).all();
    expect(productos.length).toBe(15);
    expect(DEMO_PRODUCTOS.length).toBe(15);
  });

  it('cada producto tiene existencias, un movimiento inicial y al menos un lista_precio_valor', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    const productos = db.select().from(schema.producto).all();

    for (const p of productos) {
      const ex = db.select().from(schema.existencias)
        .where(eq(schema.existencias.producto_id, p.id)).all();
      expect(ex.length).toBe(1);

      const mov = db.select().from(schema.movimiento_stock)
        .where(and(
          eq(schema.movimiento_stock.producto_id, p.id),
          eq(schema.movimiento_stock.motivo, 'inicial'),
        )).all();
      expect(mov.length).toBe(1);
      // stock_resultante del movimiento inicial coincide con el stock físico
      expect(mov[0].stock_resultante).toBe(ex[0].stock_fisico);

      const lpv = db.select().from(schema.lista_precio_valor)
        .where(eq(schema.lista_precio_valor.producto_id, p.id)).all();
      expect(lpv.length).toBeGreaterThanOrEqual(1);
      // precio_centavos > 0 y con presentación default asignada (ADR-040)
      expect(lpv[0].precio_centavos).toBeGreaterThan(0);
      expect(lpv[0].presentacion_id).not.toBeNull();
    }
  });

  it('el precio en centavos respeta la conversión pesos→centavos del producto', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    const lista = db.select().from(schema.lista_precio)
      .where(eq(schema.lista_precio.predeterminada, true)).get()!;

    const p = db.select().from(schema.producto).all()[0];
    const lpv = db.select().from(schema.lista_precio_valor)
      .where(and(
        eq(schema.lista_precio_valor.producto_id, p.id),
        eq(schema.lista_precio_valor.lista_precio_id, lista.id),
      )).get()!;
    // lista predeterminada con ajuste 0 → centavos = pesos * 100 redondeado
    expect(lpv.precio_centavos).toBe(Math.round(p.precio_venta_lista * 100));
  });

  it('cada producto tiene una presentación default (ADR-040)', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    const productos = db.select().from(schema.producto).all();
    for (const p of productos) {
      const pres = db.select().from(schema.producto_presentacion)
        .where(and(
          eq(schema.producto_presentacion.producto_id, p.id),
          eq(schema.producto_presentacion.es_default, true),
        )).all();
      expect(pres.length).toBe(1);
    }
  });

  it('incluye los casos borde: ≥1 sin stock, ≥1 bajo mínimo, ≥1 inactivo', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);

    const rows = db.select({
      activo: schema.producto.activo,
      stock_fisico: schema.existencias.stock_fisico,
      stock_minimo: schema.existencias.stock_minimo,
    })
      .from(schema.producto)
      .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
      .all();

    const sinStock = rows.filter(r => (r.stock_fisico ?? 0) === 0);
    const bajoMinimo = rows.filter(r =>
      (r.stock_fisico ?? 0) > 0
      && (r.stock_minimo ?? 0) > 0
      && (r.stock_fisico ?? 0) <= (r.stock_minimo ?? 0));
    const inactivos = rows.filter(r => r.activo === false);

    expect(sinStock.length).toBeGreaterThanOrEqual(1);
    expect(bajoMinimo.length).toBeGreaterThanOrEqual(1);
    expect(inactivos.length).toBeGreaterThanOrEqual(1);
  });

  it('los SKU avanzan el contador sku_proximo_secuencial y son únicos', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    const productos = db.select().from(schema.producto).all();
    const skus = new Set(productos.map(p => p.sku));
    expect(skus.size).toBe(15);

    const counter = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).get();
    // arrancó en 1 → tras 15 altas debe valer 16
    expect(Number.parseInt(counter!.valor, 10)).toBe(16);
  });

  it('es idempotente — segunda corrida no duplica productos ni listas', () => {
    const db = setupCatalogDb();
    runDemoCatalogSeed(db);
    runDemoCatalogSeed(db);

    expect(db.select().from(schema.producto).all().length).toBe(15);
    expect(db.select().from(schema.lista_precio).all().length).toBe(1);
  });

  it('reutiliza una lista_precio predeterminada preexistente en lugar de crear otra', () => {
    const db = setupCatalogDb();
    // Simula que ya existe una lista predeterminada activa (p. ej. creada por el usuario).
    const now = new Date();
    db.insert(schema.lista_precio).values({
      id: 'lista-existente',
      nombre: 'Mi Lista',
      tipo: 'general',
      ajuste_porcentual: 0,
      predeterminada: true,
      activo: true,
      usuario_creacion_id: 'system',
      fecha_creacion: now,
      origin_id: 'system',
      updated_at: now,
    }).run();

    runDemoCatalogSeed(db);

    expect(db.select().from(schema.lista_precio).all().length).toBe(1);
    // los precios se sembraron contra la lista existente
    const lpv = db.select().from(schema.lista_precio_valor)
      .where(eq(schema.lista_precio_valor.lista_precio_id, 'lista-existente')).all();
    expect(lpv.length).toBe(15);
  });

  it('no siembra si ya hay productos (defensa extra)', () => {
    const db = setupCatalogDb();
    // Inserta un producto arbitrario simulando catálogo preexistente.
    const now = new Date();
    const cat = db.select().from(schema.categoria).all()[0];
    db.insert(schema.producto).values({
      id: 'prod-existente',
      sku: 'P-9999999-0',
      sku_secuencial: 9999999,
      nombre_corto: 'Existente',
      nombre_largo: 'Producto existente',
      unidad_venta: 'unidad',
      categoria_id: cat.id,
      usuario_creacion_id: 'system',
      fecha_creacion: now,
      origin_id: 'system',
      updated_at: now,
    }).run();

    runDemoCatalogSeed(db);
    expect(db.select().from(schema.producto).all().length).toBe(1);
  });
});
