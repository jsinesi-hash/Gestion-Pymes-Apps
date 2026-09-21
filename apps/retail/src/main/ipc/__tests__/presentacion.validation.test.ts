import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import {
  presentacionCreateHandler,
  presentacionUpdateHandler,
  presentacionSetDefaultHandler,
  presentacionDesactivarHandler,
  presentacionEliminarHandler,
  presentacionReactivarHandler,
} from '../presentacion';

type Db = ReturnType<typeof setupDb>;
let db: Db;

function setupProducto(unidadVenta = 'u') {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, {
    nombre_corto: 'Prod test',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: unidadVenta,
    precio_venta_lista: 100,
  });
}

function unidadId(abrev: string): string {
  return db.select().from(schema.unidad)
    .where(eq(schema.unidad.abreviatura, abrev)).get()!.id;
}

beforeEach(() => {
  db = setupDb();
  loginAsAdmin(db);
});
afterEach(() => { clearSession(); });

describe('presentacion handlers — validación de payload (ADR-085)', () => {
  it('create rechaza sin unidad_id (omitido)', () => {
    const prod = setupProducto();
    expect(() => presentacionCreateHandler(db, { producto_id: prod.id, factor_a_stock: 1 } as any))
      .toThrow('VALIDATION:unidad_id:TIPO');
  });

  it('create rechaza unidad_id vacío', () => {
    const prod = setupProducto();
    expect(() => presentacionCreateHandler(db, { producto_id: prod.id, unidad_id: '', factor_a_stock: 1 } as any))
      .toThrow('VALIDATION:unidad_id:REQUERIDO');
  });

  it('create rechaza producto_id de tipo inválido (omitido)', () => {
    expect(() => presentacionCreateHandler(db, { unidad_id: 'x', factor_a_stock: 1 } as any))
      .toThrow('VALIDATION:producto_id:TIPO');
  });

  it('create rechaza factor_a_stock en 0 (no estrictamente positivo)', () => {
    const prod = setupProducto();
    expect(() => presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 0,
    } as any)).toThrow('VALIDATION:factor_a_stock:MIN:0.001');
  });

  it('create rechaza factor_a_stock de tipo inválido', () => {
    const prod = setupProducto();
    expect(() => presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 'doce',
    } as any)).toThrow('VALIDATION:factor_a_stock:TIPO');
  });

  it('create rechaza gtin_barcode de tipo inválido', () => {
    const prod = setupProducto();
    expect(() => presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 1, gtin_barcode: 123,
    } as any)).toThrow('VALIDATION:gtin_barcode:TIPO');
  });

  it('create acepta payload válido', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 12,
    } as any);
    expect(pp.factor_a_stock).toBe(12);
    expect(pp.producto_id).toBe(prod.id);
  });

  it('update rechaza id vacío', () => {
    expect(() => presentacionUpdateHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('update rechaza id de tipo inválido (omitido)', () => {
    expect(() => presentacionUpdateHandler(db, {} as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('update rechaza factor_a_stock en 0', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 6,
    });
    expect(() => presentacionUpdateHandler(db, { id: pp.id, factor_a_stock: 0 } as any))
      .toThrow('VALIDATION:factor_a_stock:MIN:0.001');
  });

  it('update rechaza unidad_id de tipo inválido', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 6,
    });
    expect(() => presentacionUpdateHandler(db, { id: pp.id, unidad_id: 123 } as any))
      .toThrow('VALIDATION:unidad_id:TIPO');
  });

  it('update rechaza sin_confirmar de tipo inválido', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 6,
    });
    expect(() => presentacionUpdateHandler(db, { id: pp.id, sin_confirmar: 'si' } as any))
      .toThrow('VALIDATION:sin_confirmar:TIPO');
  });

  it('update sigue permitiendo limpiar el GTIN con null explícito', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 6, gtin_barcode: '7790011122',
    });
    const updated = presentacionUpdateHandler(db, { id: pp.id, gtin_barcode: null } as any);
    expect(updated.gtin_barcode).toBeNull();
  });

  it('update sin tocar gtin_barcode no lo modifica', () => {
    const prod = setupProducto();
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId('u'), factor_a_stock: 6, gtin_barcode: '7790011199',
    });
    const updated = presentacionUpdateHandler(db, { id: pp.id, factor_a_stock: 8 } as any);
    expect(updated.gtin_barcode).toBe('7790011199');
  });

  it('setDefault rechaza id vacío', () => {
    expect(() => presentacionSetDefaultHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('setDefault rechaza id de tipo inválido', () => {
    expect(() => presentacionSetDefaultHandler(db, { id: 123 } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('desactivar rechaza id vacío', () => {
    expect(() => presentacionDesactivarHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('desactivar rechaza id de tipo inválido', () => {
    expect(() => presentacionDesactivarHandler(db, { id: 123 } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('eliminar rechaza id vacío', () => {
    expect(() => presentacionEliminarHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('eliminar rechaza id de tipo inválido', () => {
    expect(() => presentacionEliminarHandler(db, { id: 123 } as any))
      .toThrow('VALIDATION:id:TIPO');
  });

  it('reactivar rechaza id vacío', () => {
    expect(() => presentacionReactivarHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('reactivar rechaza id de tipo inválido', () => {
    expect(() => presentacionReactivarHandler(db, { id: 123 } as any))
      .toThrow('VALIDATION:id:TIPO');
  });
});
