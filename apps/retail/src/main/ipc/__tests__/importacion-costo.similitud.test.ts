import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { normalizar } from '@ferreteria/shared';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import * as schema from '../../db/schema';
import { runCatalogSeed } from '../../catalog/seed';
import { runSinonimoSeed } from '../../sinonimos/seed';
import {
  importacionCostoGetColaRevisionHandler,
  importacionCostoResolverFilaHandler,
} from '../importacion-costo';

const now = new Date();
const SYNC = { version: 1 as const, origin_id: 'system', sync_state: 'pending' as const, updated_at: now };

function insertarProducto(db: ReturnType<typeof setupDb>, nombre: string, seq: number): string {
  const cat = db.select().from(schema.categoria).all()[0];
  const id = randomUUID();
  db.insert(schema.producto).values({
    id, sku: `P-000000${seq}-0`, sku_secuencial: seq,
    nombre_corto: nombre, nombre_corto_norm: normalizar(nombre), nombre_largo: nombre,
    unidad_venta: 'unidad', categoria_id: cat.id,
    usuario_creacion_id: 'system', fecha_creacion: now, ...SYNC,
  }).run();
  return id;
}

function insertarProveedor(db: ReturnType<typeof setupDb>, umbral: number | null): string {
  const id = randomUUID();
  db.insert(schema.proveedor).values({
    id, tipo_documento: 'CUIT', numero_documento: '30111111118', razon_social: 'Proveedor Test',
    condicion_fiscal: 'Responsable Inscripto', match_umbral_preseleccion: umbral,
    usuario_creacion_id: 'system', fecha_creacion: now, ...SYNC,
  }).run();
  return id;
}

// Crea una importación con una fila sin_matchear cuyo NOMBRE (en fila_original) es `nombreArchivo`.
function insertarFilaSinMatch(db: ReturnType<typeof setupDb>, proveedorId: string, nombreProducto: string): string {
  const impId = randomUUID();
  db.insert(schema.importacion_costo_proveedor).values({
    id: impId, proveedor_id: proveedorId, nombre_archivo: 'lista.csv', fecha_importacion: now,
    estado: 'pendiente', usuario_id: 'system', ...SYNC,
  }).run();
  const detId = randomUUID();
  db.insert(schema.importacion_costo_proveedor_detalle).values({
    id: detId, importacion_id: impId, costo_nuevo_centavos: 10000,
    fila_original: JSON.stringify({ fila_num: 1, datos: { NOMBRE: nombreProducto, COD_PRODUCTO_PROV: 'X123', COSTO: '100' } }),
    estado: 'sin_matchear', ...SYNC,
  }).run();
  return detId;
}

describe('importacion-costo — sugerencias por similitud (ADR-063 Lote 4)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); runSinonimoSeed(db); loginAsAdmin(db); });
  afterEach(() => { clearSession(); });

  it('la cola sugiere el producto por nombre (sinónimo pinza→alicate)', async () => {
    const prov = insertarProveedor(db, null);
    const prodId = insertarProducto(db, 'Alicate universal 8 pulgadas', 1);
    insertarProducto(db, 'Martillo carpintero 500g', 2);
    insertarFilaSinMatch(db, prov, 'Pinza universal 8 pulgadas');

    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola.length).toBe(1);
    expect(cola[0].nombre_producto_archivo).toBe('Pinza universal 8 pulgadas');
    expect(cola[0].candidatos[0].producto_id).toBe(prodId);
    expect(cola[0].candidatos[0].score).toBeGreaterThan(0.5);
    expect(cola[0].candidatos.map(c => c.nombre_corto)).not.toContain('Martillo carpintero 500g');
    // sin umbral → sin pre-selección
    expect(cola[0].preseleccion).toBeNull();
  });

  it('con umbral del proveedor, un acierto alto llega pre-seleccionado', async () => {
    const prov = insertarProveedor(db, 50);
    const prodId = insertarProducto(db, 'Alicate universal 8 pulgadas', 1);
    insertarFilaSinMatch(db, prov, 'Pinza universal 8 pulgadas');

    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola[0].preseleccion).not.toBeNull();
    expect(cola[0].preseleccion!.producto_id).toBe(prodId);
  });

  it('resolver aceptando una sugerencia marca matched_by = similitud', async () => {
    const prov = insertarProveedor(db, null);
    const prodId = insertarProducto(db, 'Alicate universal 8 pulgadas', 1);
    const detId = insertarFilaSinMatch(db, prov, 'Pinza universal 8 pulgadas');

    await importacionCostoResolverFilaHandler(db, { detalleId: detId, productoId: prodId, proveedorId: prov, origen: 'similitud' });

    const det = db.select().from(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.id, detId)).get()!;
    expect(det.estado).toBe('resuelto_manual');
    expect(det.matched_by).toBe('similitud');
    // sale de la cola
    expect((await importacionCostoGetColaRevisionHandler(db)).length).toBe(0);
  });

  it('usa la columna DESCRIPCION del archivo para sugerir (no solo NOMBRE)', async () => {
    const prov = insertarProveedor(db, null);
    const prodId = insertarProducto(db, 'Alicate universal 8 pulgadas', 1);
    // fila cuyo texto de producto viene en DESCRIPCION (como la plantilla y los archivos reales)
    const impId = randomUUID();
    db.insert(schema.importacion_costo_proveedor).values({
      id: impId, proveedor_id: prov, nombre_archivo: 'lista.csv', fecha_importacion: now,
      estado: 'pendiente', usuario_id: 'system', ...SYNC,
    }).run();
    db.insert(schema.importacion_costo_proveedor_detalle).values({
      id: randomUUID(), importacion_id: impId, costo_nuevo_centavos: 10000,
      fila_original: JSON.stringify({ fila_num: 1, datos: { DESCRIPCION: 'Pinza universal 8 pulgadas', COD_PRODUCTO_PROV: 'X123', COSTO: '100' } }),
      estado: 'sin_matchear', ...SYNC,
    }).run();

    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola.length).toBe(1);
    expect(cola[0].nombre_producto_archivo).toBe('Pinza universal 8 pulgadas');
    expect(cola[0].candidatos[0].producto_id).toBe(prodId);
  });

  it('una fila sin NOMBRE en el archivo no rompe (candidatos vacíos)', async () => {
    const prov = insertarProveedor(db, 50);
    insertarProducto(db, 'Alicate universal 8 pulgadas', 1);
    // fila sin la columna NOMBRE
    const impId = randomUUID();
    db.insert(schema.importacion_costo_proveedor).values({
      id: impId, proveedor_id: prov, nombre_archivo: 'l.csv', fecha_importacion: now,
      estado: 'pendiente', usuario_id: 'system', ...SYNC,
    }).run();
    db.insert(schema.importacion_costo_proveedor_detalle).values({
      id: randomUUID(), importacion_id: impId, costo_nuevo_centavos: 5000,
      fila_original: JSON.stringify({ fila_num: 1, datos: { COD_PRODUCTO_PROV: 'Z9', COSTO: '50' } }),
      estado: 'sin_matchear', ...SYNC,
    }).run();

    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola[0].nombre_producto_archivo).toBeNull();
    expect(cola[0].candidatos).toEqual([]);
    expect(cola[0].preseleccion).toBeNull();
  });
});
