import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import * as schema from '../../db/schema';
import {
  etiquetasListarProductosHandler,
  etiquetasListarPerfilesHandler,
  etiquetasGuardarPerfilHandler,
} from '../etiquetas';
import type { PerfilEtiqueta } from '@ferreteria/shared';

type Db = ReturnType<typeof setupDb>;

function makeProducto(
  db: Db,
  overrides: { nombre_corto?: string; precio_venta_lista?: number } = {},
) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat Test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, {
    nombre_corto: overrides.nombre_corto ?? 'Producto Test',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: overrides.precio_venta_lista ?? 150.5,
  });
}

const PERFIL_BASE: PerfilEtiqueta = {
  id: 'p1',
  nombre: 'Rollo 70x36',
  tipo: 'rollo',
  ancho_mm: 70,
  alto_mm: 36,
  barcode_tipo: 'qr',
};

// --- listar-productos ---

describe('etiquetasListarProductosHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => etiquetasListarProductosHandler(db, {})).toThrow('UNAUTHENTICATED');
  });

  it('retorna solo productos activos', () => {
    loginAsAdmin(db);
    makeProducto(db, { nombre_corto: 'Activo' });
    // crear segundo producto y darlo de baja
    const p2 = makeProducto(db, { nombre_corto: 'Inactivo' });
    db.update(schema.producto).set({ activo: false }).where(eq(schema.producto.id, p2.id)).run();
    const result = etiquetasListarProductosHandler(db, {});
    expect(result.map(r => r.nombre)).toContain('Activo');
    expect(result.map(r => r.nombre)).not.toContain('Inactivo');
  });

  it('convierte precio_venta_lista (real) a centavos enteros', () => {
    loginAsAdmin(db);
    makeProducto(db, { precio_venta_lista: 150.5 });
    const result = etiquetasListarProductosHandler(db, {});
    expect(result[0].precio_venta_lista_centavos).toBe(15050);
  });

  it('retorna EtiquetaItem con los campos correctos', () => {
    loginAsAdmin(db);
    const p = makeProducto(db, { nombre_corto: 'Tornillo', precio_venta_lista: 10 });
    const result = etiquetasListarProductosHandler(db, {});
    expect(result[0].producto_id).toBe(p.id);
    expect(result[0].sku).toBe(p.sku);
    expect(result[0].nombre).toBe('Tornillo');
  });

  it('retorna gtin_barcode del producto cuando tiene EAN', () => {
    loginAsAdmin(db);
    const p = makeProducto(db, { nombre_corto: 'Con EAN' });
    db.update(schema.producto)
      .set({ gtin_barcode: '7896543211234' })
      .where(eq(schema.producto.id, p.id))
      .run();
    const result = etiquetasListarProductosHandler(db, {});
    expect(result[0].gtin_barcode).toBe('7896543211234');
  });

  it('retorna gtin_barcode null cuando el producto no tiene EAN', () => {
    loginAsAdmin(db);
    makeProducto(db, { nombre_corto: 'Sin EAN' });
    const result = etiquetasListarProductosHandler(db, {});
    expect(result[0].gtin_barcode).toBeNull();
  });

  it('filtra por q: nombre parcial', () => {
    loginAsAdmin(db);
    makeProducto(db, { nombre_corto: 'Tornillo' });
    makeProducto(db, { nombre_corto: 'Clavo' });
    const result = etiquetasListarProductosHandler(db, { q: 'Tornillo' });
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Tornillo');
  });

  it('filtra por categoriaId', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat1 = categoriaCreateHandler(db, { nombre: 'Cat1' });
    const cat2 = categoriaCreateHandler(db, { nombre: 'Cat2' });
    const imp  = db.select().from(schema.impuesto).all()[0];
    productoCreateHandler(db, { nombre_corto: 'P-Cat1', categoria_id: cat1.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 10 });
    productoCreateHandler(db, { nombre_corto: 'P-Cat2', categoria_id: cat2.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 10 });
    const result = etiquetasListarProductosHandler(db, { categoriaId: cat1.id });
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('P-Cat1');
  });

  it('filtra stockStatus=con: incluye solo productos con stock_fisico > 0', () => {
    loginAsAdmin(db);
    const p = makeProducto(db);
    stockEntradaHandler(db, { producto_id: p.id, cantidad: 5 });
    const p2 = makeProducto(db, { nombre_corto: 'Sin stock' });

    const conStock = etiquetasListarProductosHandler(db, { stockStatus: 'con' });
    expect(conStock.some(r => r.producto_id === p.id)).toBe(true);
    expect(conStock.some(r => r.producto_id === p2.id)).toBe(false);
  });

  it('filtra stockStatus=sin: incluye solo productos con stock_fisico = 0', () => {
    loginAsAdmin(db);
    const p = makeProducto(db); // sin entrada → stock = 0
    const p2 = makeProducto(db, { nombre_corto: 'Con stock' });
    stockEntradaHandler(db, { producto_id: p2.id, cantidad: 3 });

    const sinStock = etiquetasListarProductosHandler(db, { stockStatus: 'sin' });
    expect(sinStock.some(r => r.producto_id === p.id)).toBe(true);
    expect(sinStock.some(r => r.producto_id === p2.id)).toBe(false);
  });
});

// --- listar-perfiles ---

describe('etiquetasListarPerfilesHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => etiquetasListarPerfilesHandler(db)).toThrow('UNAUTHENTICATED');
  });

  it('retorna [] si no existe la clave en parametros_sistema', () => {
    loginAsAdmin(db);
    expect(etiquetasListarPerfilesHandler(db)).toEqual([]);
  });

  it('retorna los perfiles previamente guardados', () => {
    loginAsAdmin(db);
    etiquetasGuardarPerfilHandler(db, PERFIL_BASE);
    const perfiles = etiquetasListarPerfilesHandler(db);
    expect(perfiles).toHaveLength(1);
    expect(perfiles[0]).toEqual(PERFIL_BASE);
  });
});

// --- guardar-perfil ---

describe('etiquetasGuardarPerfilHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => etiquetasGuardarPerfilHandler(db, PERFIL_BASE)).toThrow('UNAUTHENTICATED');
  });

  it('inserta un nuevo perfil y lo retorna en el array', () => {
    loginAsAdmin(db);
    const result = etiquetasGuardarPerfilHandler(db, PERFIL_BASE);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(PERFIL_BASE);
  });

  it('actualiza un perfil existente por id', () => {
    loginAsAdmin(db);
    etiquetasGuardarPerfilHandler(db, PERFIL_BASE);
    const updated = etiquetasGuardarPerfilHandler(db, { ...PERFIL_BASE, nombre: 'Actualizado' });
    expect(updated).toHaveLength(1);
    expect(updated[0].nombre).toBe('Actualizado');
  });

  it('acumula múltiples perfiles distintos', () => {
    loginAsAdmin(db);
    const p2: PerfilEtiqueta = {
      id: 'p2', nombre: 'A4 3x8', tipo: 'hoja',
      ancho_mm: 210, alto_mm: 297, cols: 3, filas: 8,
      margen_mm: 10, gap_mm: 2, barcode_tipo: 'code128',
    };
    etiquetasGuardarPerfilHandler(db, PERFIL_BASE);
    const result = etiquetasGuardarPerfilHandler(db, p2);
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toContain('p1');
    expect(result.map(p => p.id)).toContain('p2');
  });

  it('persiste: guardar-perfil escribe lo que listar-perfiles puede leer', () => {
    loginAsAdmin(db);
    etiquetasGuardarPerfilHandler(db, PERFIL_BASE);
    const leidos = etiquetasListarPerfilesHandler(db);
    expect(leidos[0]).toEqual(PERFIL_BASE);
  });
});
