import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler } from '../producto-proveedor';
import {
  importacionCatalogoParseArchivoHandler,
  importacionCatalogoRevalidarFilaHandler,
  importacionCatalogoConfirmarHandler,
  importacionCatalogoGetHistorialHandler,
  importacionCatalogoGetHistorialDetalleHandler,
  importacionCatalogoBuscarProductosHandler,
  type FilaCatalogoPreview,
} from '../importacion-catalogo';
import * as schema from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let productoId: string;
let sku: string;
let proveedorId: string;
let tmpDir: string;

function writeTempCsv(content: string): string {
  const filePath = path.join(tmpDir, `cat-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

async function parsear(csv: string) {
  return importacionCatalogoParseArchivoHandler(db, { filePath: writeTempCsv(csv), proveedorId });
}

function ppDe(prodId: string) {
  return db.select().from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, prodId),
      eq(schema.producto_proveedor.proveedor_id, proveedorId),
      isNull(schema.producto_proveedor.deleted_at),
    )).get();
}

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ferr-cat-'));

  const cat = categoriaCreateHandler(db, { nombre: 'Ferretería' });
  const imp = db.select().from(schema.impuesto).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo 4x40', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 50000,
  });
  productoId = prod.id;
  sku = prod.sku;
  db.update(schema.producto).set({ gtin_barcode: '7791234567890' }).where(eq(schema.producto.id, productoId)).run();

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT', numero_documento: '20333333334',
    razon_social: 'Prov Test SA', condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorId = prov.id;
  // NO se vincula el producto al proveedor a propósito (para probar "crear").
});

describe('importacionCatalogoParseArchivoHandler', () => {
  it('matchea por EAN (global) y marca "crear" cuando el producto no está vinculado', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n');
    const f = preview.filas[0];
    expect(f.matched_by).toBe('gtin');
    expect(f.producto_id).toBe(productoId);
    expect(f.accion).toBe('crear');
    expect(f.costo_centavos).toBe(12000);
    expect(preview.total_crear).toBe(1);
  });

  it('matchea por código interno (SKU) cuando no hay EAN', async () => {
    const preview = await parsear(`EAN,COD_PRODUCTO_PROV,COD_INTERNO,COSTO\n,A-100,${sku},120.00\n`);
    const f = preview.filas[0];
    expect(f.matched_by).toBe('codigo_interno');
    expect(f.producto_id).toBe(productoId);
    expect(f.accion).toBe('crear');
  });

  it('marca "actualizar" cuando el producto YA está vinculado a este proveedor', async () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 8000, codigo_proveedor: 'VIEJO' });
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n');
    const f = preview.filas[0];
    expect(f.accion).toBe('actualizar');
    expect(f.costo_anterior_centavos).toBe(8000);
  });

  it('un producto que no existe en el catálogo queda sin_matchear (no se crean productos)', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n0000000000000,A-100,120.00\n');
    const f = preview.filas[0];
    expect(f.accion).toBe('sin_matchear');
    expect(f.producto_id).toBeNull();
  });

  it('falta COD_PRODUCTO_PROV → error', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,,120.00\n');
    const f = preview.filas[0];
    expect(f.accion).toBe('error');
    expect(f.motivo).toMatch(/código del producto del proveedor/i);
  });

  it('costo escrito pero inválido → error (aunque el costo sea opcional)', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,no-es-numero\n');
    const f = preview.filas[0];
    expect(f.accion).toBe('error');
    expect(f.motivo).toMatch(/costo/i);
  });

  it('costo vacío es válido (opcional) → crear', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,\n');
    const f = preview.filas[0];
    expect(f.accion).toBe('crear');
    expect(f.costo_centavos).toBeNull();
  });
});

describe('importacionCatalogoRevalidarFilaHandler', () => {
  it('corregir el EAN por uno válido re-identifica el producto', () => {
    const r = importacionCatalogoRevalidarFilaHandler(db, {
      proveedorId, datos: { EAN: '7791234567890', COD_PRODUCTO_PROV: 'A-100', COSTO: '120' },
    });
    expect(r.producto_id).toBe(productoId);
    expect(r.accion).toBe('crear');
  });
});

describe('importacionCatalogoConfirmarHandler', () => {
  it('crea el vínculo con código y costo, y asigna preferido si el producto no tenía ninguno', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n');
    const res = importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas: preview.filas });
    expect(res.creados).toBe(1);
    expect(res.preferidos_asignados).toBe(1);

    const pp = ppDe(productoId)!;
    expect(pp.codigo_proveedor).toBe('A-100');
    expect(pp.costo_centavos).toBe(12000);
    expect(pp.preferido).toBe(true);
  });

  it('NO pisa el preferido si el producto ya tiene uno de otro proveedor', async () => {
    // otro proveedor ya es el preferido del producto
    const otro = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20999999997',
      razon_social: 'Otro Prov', condicion_fiscal: 'Responsable Inscripto',
    });
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: otro.id, costo_centavos: 5000, codigo_proveedor: 'O-1' });
    db.update(schema.producto_proveedor).set({ preferido: true })
      .where(and(eq(schema.producto_proveedor.producto_id, productoId), eq(schema.producto_proveedor.proveedor_id, otro.id))).run();

    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n');
    const res = importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas: preview.filas });
    expect(res.creados).toBe(1);
    expect(res.preferidos_asignados).toBe(0); // no se asignó preferido

    const nuestro = ppDe(productoId)!;
    expect(nuestro.preferido).toBe(false); // el nuevo NO es preferido
    // el preferido sigue siendo el del otro proveedor
    const delOtro = db.select().from(schema.producto_proveedor)
      .where(and(eq(schema.producto_proveedor.producto_id, productoId), eq(schema.producto_proveedor.proveedor_id, otro.id))).get()!;
    expect(delOtro.preferido).toBe(true);
  });

  it('actualiza un vínculo existente (código y costo) sin tocar su preferido', async () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 8000, codigo_proveedor: 'VIEJO' });
    db.update(schema.producto_proveedor).set({ preferido: true })
      .where(and(eq(schema.producto_proveedor.producto_id, productoId), eq(schema.producto_proveedor.proveedor_id, proveedorId))).run();

    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-NUEVO,150.00\n');
    const res = importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas: preview.filas });
    expect(res.actualizados).toBe(1);

    const pp = ppDe(productoId)!;
    expect(pp.codigo_proveedor).toBe('A-NUEVO');
    expect(pp.costo_centavos).toBe(15000);
    expect(pp.preferido).toBe(true); // se mantiene
  });

  it('si el costo no viene, al actualizar conserva el costo anterior', async () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 8000, codigo_proveedor: 'VIEJO' });
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-NUEVO,\n');
    importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas: preview.filas });
    const pp = ppDe(productoId)!;
    expect(pp.codigo_proveedor).toBe('A-NUEVO');
    expect(pp.costo_centavos).toBe(8000); // conservado
  });

  it('no toca filas sin_matchear ni con error', async () => {
    const filas: FilaCatalogoPreview[] = [
      { fila_num: 1, gtin_archivo: '0000000000000', codigo_producto_prov: 'X', codigo_interno_archivo: null, producto_id: null, nombre_producto: null, sku_producto: null, matched_by: null, costo_centavos: 1000, costo_anterior_centavos: null, accion: 'sin_matchear', motivo: 'x', datos: {}, nombre_producto_archivo: null, candidatos: [] },
    ];
    const res = importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas });
    expect(res.creados).toBe(0);
    expect(res.actualizados).toBe(0);
    expect(res.sin_identificar).toBe(1);
  });

  // ADR-063 Lote 4: sugerencias por similitud de nombre en filas sin match por EAN/código.
  it('ofrece candidatos por NOMBRE en una fila sin_matchear y permite aceptarlos', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,NOMBRE,COSTO\n0000000000000,PROV-9,Tornillo 4x40 zincado,100\n');
    const fila = preview.filas[0];
    expect(fila.accion).toBe('sin_matchear');
    expect(fila.nombre_producto_archivo).toBe('Tornillo 4x40 zincado');
    expect(fila.candidatos.map(c => c.producto_id)).toContain(productoId);

    // El operador acepta el candidato (client-side): la fila pasa a 'actualizar' por similitud.
    const c = fila.candidatos.find(c => c.producto_id === productoId)!;
    const resuelta: FilaCatalogoPreview = {
      ...fila, producto_id: c.producto_id, nombre_producto: c.nombre_corto, sku_producto: c.sku,
      accion: 'actualizar', matched_by: 'similitud', motivo: null,
    };
    importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'x.csv', filas: [resuelta] });

    const pp = ppDe(productoId)!;
    expect(pp.codigo_proveedor).toBe('PROV-9'); // aprende el código del proveedor
  });

  // La plantilla y los archivos reales usan la columna DESCRIPCION (no NOMBRE): la
  // similitud debe alimentarse igual de esa columna.
  it('ofrece candidatos por DESCRIPCION (columna real de la plantilla) en una fila sin_matchear', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,DESCRIPCION,COSTO\n0000000000000,PROV-9,Tornillo 4x40 zincado,100\n');
    const fila = preview.filas[0];
    expect(fila.accion).toBe('sin_matchear');
    expect(fila.nombre_producto_archivo).toBe('Tornillo 4x40 zincado');
    expect(fila.candidatos.map(c => c.producto_id)).toContain(productoId);
  });
});

describe('importacionCatalogoConfirmarHandler — persistencia de historial (ADR-054)', () => {
  it('persiste cabecera + detalle y devuelve las filas con preferido_asignado', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n0000000000000,A-200,50.00\n');
    const res = importacionCatalogoConfirmarHandler(db, {
      proveedorId, nombreArchivo: 'catalogo.csv', filas: preview.filas,
    });
    expect(res.creados).toBe(1);
    expect(res.sin_identificar).toBe(1);
    expect(res.importacion_id).toBeTruthy();

    const cab = db.select().from(schema.importacion_catalogo_proveedor).all();
    expect(cab.length).toBe(1);
    expect(cab[0].filas_totales).toBe(2);
    expect(cab[0].filas_creadas).toBe(1);
    expect(cab[0].filas_sin_match).toBe(1);
    expect(cab[0].nombre_archivo).toBe('catalogo.csv');

    const det = db.select().from(schema.importacion_catalogo_proveedor_detalle).all();
    expect(det.length).toBe(2);

    const creada = res.filas.find(f => f.accion === 'crear');
    expect(creada?.preferido_asignado).toBe(true);
    const sinMatch = res.filas.find(f => f.accion === 'sin_matchear');
    expect(sinMatch?.preferido_asignado).toBe(false);
  });
});

describe('importacionCatalogoGetHistorialHandler / getHistorialDetalle (ADR-054)', () => {
  it('lista las importaciones confirmadas con su desglose y el detalle', async () => {
    const preview = await parsear('EAN,COD_PRODUCTO_PROV,COSTO\n7791234567890,A-100,120.00\n0000000000000,A-200,50.00\n');
    importacionCatalogoConfirmarHandler(db, { proveedorId, nombreArchivo: 'cat.csv', filas: preview.filas });

    const hist = importacionCatalogoGetHistorialHandler(db);
    expect(hist.length).toBe(1);
    expect(hist[0].proveedor).toBe('Prov Test SA');
    expect(hist[0].filas_totales).toBe(2);
    expect(hist[0].creados).toBe(1);
    expect(hist[0].sin_match).toBe(1);
    expect(hist[0].estado).toBe('confirmado');

    const det = importacionCatalogoGetHistorialDetalleHandler(db, hist[0].id);
    expect(det.length).toBe(2);
    expect(det.some(d => d.nombre_producto === 'Tornillo 4x40')).toBe(true);
    const creada = det.find(d => d.estado === 'crear');
    expect(creada?.preferido_asignado).toBe(true);
  });
});

describe('importacionCatalogoBuscarProductosHandler (ADR-054)', () => {
  it('busca por nombre e incluye el código del producto para ese proveedor', () => {
    productoProveedorUpsertHandler(db, { producto_id: productoId, proveedor_id: proveedorId, costo_centavos: 8000, codigo_proveedor: 'ABC-1' });
    const res = importacionCatalogoBuscarProductosHandler(db, { proveedorId, busqueda: 'Tornillo' });
    expect(res.length).toBeGreaterThan(0);
    const hit = res.find(r => r.id === productoId)!;
    expect(hit.codigo_proveedor).toBe('ABC-1');
  });

  it('devuelve vacío con menos de 2 caracteres', () => {
    expect(importacionCatalogoBuscarProductosHandler(db, { proveedorId, busqueda: 'T' })).toEqual([]);
  });
});
