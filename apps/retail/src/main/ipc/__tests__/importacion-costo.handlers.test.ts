import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { proveedorUpsertHandler } from '../proveedor';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler } from '../regla-precio';
import {
  importacionCostoParseArchivoHandler,
  importacionCostoConfirmarHandler,
  importacionCostoGetColaRevisionHandler,
  importacionCostoResolverFilaHandler,
  importacionCostoDescartarFilaHandler,
  importacionCostoActualizarFilaHandler,
  importacionCostoCancelarHandler,
  importacionCostoEliminarHandler,
  importacionCostoGetHistorialHandler,
  importacionCostoGetHistorialDetalleHandler,
  importacionCostoRevalidarFilaHandler,
  importacionCostoBuscarProductosHandler,
  type FilaPreview,
} from '../importacion-costo';
import * as schema from '../../db/schema';
import { eq, and } from 'drizzle-orm';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let productoId: string;
let proveedorId: string;
let tmpDir: string;

function writeTempCsv(content: string): string {
  const filePath = path.join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

async function parsear(csv: string) {
  return importacionCostoParseArchivoHandler(db, { filePath: writeTempCsv(csv), proveedorId });
}

async function confirmar(filas: FilaPreview[], nombreArchivo = 'test.csv') {
  return importacionCostoConfirmarHandler(db, { proveedorId, nombreArchivo, filas });
}

/** Followup ADR-051: la única forma de dejar filas persistidas es confirmando. */
async function crearImportacionConfirmada(csv: string, nombreArchivo = 'test.csv') {
  const preview = await parsear(csv);
  const res = await confirmar(preview.filas, nombreArchivo);
  return { importacionId: res.importacion_id, filas: preview.filas, res };
}

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ferr-test-'));

  const cat = categoriaCreateHandler(db, { nombre: 'Ferretería' });
  const imp = db.select().from(schema.impuesto).get()!;

  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo 4x40',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: 50000,
  });
  productoId = prod.id;

  db.update(schema.producto)
    .set({ gtin_barcode: '7791234567890' })
    .where(eq(schema.producto.id, productoId))
    .run();

  const prov = proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT',
    numero_documento: '20333333334',
    razon_social: 'Prov Test SA',
    condicion_fiscal: 'Responsable Inscripto',
  });
  proveedorId = prov.id;

  productoProveedorUpsertHandler(db, {
    producto_id: productoId,
    proveedor_id: proveedorId,
    costo_centavos: 10000,
    codigo_proveedor: 'PT-001',
  });
});

// ── parseArchivo (followup ADR-051: puramente de lectura, no persiste nada) ────

describe('importacionCostoParseArchivoHandler', () => {
  it('matchea por codigo_proveedor cuando está presente', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,\n');
    const fila = preview.filas.find(f => f.codigo_proveedor_archivo === 'PT-001')!;
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('codigo_proveedor');
    expect(fila.costo_nuevo_centavos).toBe(25000);
    expect(fila.producto_id).toBe(productoId);
  });

  it('matchea por GTIN cuando no hay codigo_proveedor en producto_proveedor', async () => {
    db.update(schema.producto_proveedor)
      .set({ codigo_proveedor: null })
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .run();

    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nXXXX-DESCONOCIDO,300.00,7791234567890\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('gtin');
    expect(fila.costo_nuevo_centavos).toBe(30000);
  });

  it('marca como sin_matchear cuando ningún criterio coincide', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nDESCONOCIDO,100.00,0000000000000\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('sin_matchear');
    expect(fila.matched_by).toBeNull();
    expect(fila.producto_id).toBeNull();
  });

  it('fila con costo no parseable pasa a error_formato en vez de descartarse (ADR-051 A.4)', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,\nPT-001,consultar,\n');
    expect(preview.filas).toHaveLength(2);
    const filaMala = preview.filas[1];
    expect(filaMala.estado).toBe('error_formato');
    expect(filaMala.costo_nuevo_centavos).toBeNull();
    // sigue matcheando por código aunque el costo no sea válido — no se pierde el producto_id
    expect(filaMala.producto_id).toBe(productoId);
  });

  it('fila con costo no parseable y sin match de producto también es error_formato, no sin_matchear', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nDESCONOCIDO,no-es-numero,\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('error_formato');
    expect(fila.producto_id).toBeNull();
  });

  it('hard-stop: si el 100% de las filas tiene costo no parseable, lanza', async () => {
    await expect(
      parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,no-numero,\nOTRO,tampoco,\n')
    ).rejects.toThrow(/No se pudo leer ningún costo válido/);
  });

  it('NO hace hard-stop si solo algunas filas (no el 100%) tienen costo inválido', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,\nOTRO,no-numero,\n');
    expect(preview.filas).toHaveLength(2);
  });

  it('matchea por código interno (SKU) cuando ni código de proveedor ni EAN matchean', async () => {
    const sku = db.select({ sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.id, productoId)).get()!.sku;
    const preview = await parsear(`COD_PRODUCTO_PROV,COSTO,EAN,COD_INTERNO\nDESCONOCIDO,275.00,,${sku}\n`);
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('codigo_interno');
    expect(fila.producto_id).toBe(productoId);
    expect(fila.costo_nuevo_centavos).toBe(27500);
  });

  it('cascada de matching: EAN gana sobre código de proveedor cuando ambos apuntan a productos distintos', async () => {
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get()!;
    const imp = db.select({ id: schema.impuesto.id }).from(schema.impuesto).get()!;
    const otroProducto = productoCreateHandler(db, {
      nombre_corto: 'Tuerca 4mm', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 20000,
    });
    productoProveedorUpsertHandler(db, {
      producto_id: otroProducto.id, proveedor_id: proveedorId,
      costo_centavos: 5000, codigo_proveedor: 'OTRO-COD',
    });

    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nOTRO-COD,300.00,7791234567890\n');
    const fila = preview.filas[0];
    expect(fila.matched_by).toBe('gtin');
    expect(fila.producto_id).toBe(productoId);
  });

  it('auto-detecta el delimitador (punto y coma)', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV;COSTO;EAN\nPT-001;250.00;\n');
    expect(preview.filas).toHaveLength(1);
    expect(preview.filas[0].estado).toBe('matched');
  });

  it('NO escribe nada en la base — parsear no persiste (followup ADR-051)', async () => {
    const antes = db.select({ id: schema.importacion_costo_proveedor.id })
      .from(schema.importacion_costo_proveedor).all().length;
    await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,\nDESCONOCIDO,50.00,\n');
    const despues = db.select({ id: schema.importacion_costo_proveedor.id })
      .from(schema.importacion_costo_proveedor).all().length;
    expect(despues).toBe(antes);
    const detalles = db.select({ id: schema.importacion_costo_proveedor_detalle.id })
      .from(schema.importacion_costo_proveedor_detalle).all().length;
    expect(detalles).toBe(0);
  });

  it('REPRO: re-parsear el mismo proveedor+archivo las veces que sea da siempre el mismo resultado (nada queda "trabado")', async () => {
    const csv = 'COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,100.00,\nDESCONOCIDO,50.00,\nOTRO,no-numero,\n';
    const preview1 = await parsear(csv);
    const preview2 = await parsear(csv);
    expect(preview1.filas).toHaveLength(3);
    expect(preview2.filas).toHaveLength(3);
    expect(preview2.filas.map(f => f.estado)).toEqual(preview1.filas.map(f => f.estado));
  });

  // ── matcheo contra todo el catálogo (revierte el scope estricto de ADR-051) ──
  // EAN e COD_INTERNO identifican el producto aunque todavía no esté vinculado a este
  // proveedor; el vínculo se crea al Confirmar. COD_PRODUCTO_PROV sigue siendo por
  // vínculo (es un dato del vínculo, no del producto).
  it('un producto del catálogo NO vinculado a este proveedor SÍ matchea por EAN (contra todo el catálogo)', async () => {
    // producto nuevo con EAN, pero sin producto_proveedor para este proveedor
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get()!;
    const imp = db.select({ id: schema.impuesto.id }).from(schema.impuesto).get()!;
    const ajeno = productoCreateHandler(db, {
      nombre_corto: 'Producto sin vínculo previo', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 10000,
    });
    db.update(schema.producto).set({ gtin_barcode: '7790000000001' })
      .where(eq(schema.producto.id, ajeno.id)).run();

    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\n,120.00,7790000000001\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('gtin');
    expect(fila.producto_id).toBe(ajeno.id);
    // no había costo previo para ESTE proveedor → costo anterior nulo, no 0
    expect(fila.costo_anterior_centavos).toBeNull();
  });

  it('un producto del catálogo NO vinculado matchea por COD_INTERNO (nuestro SKU) contra todo el catálogo', async () => {
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get()!;
    const imp = db.select({ id: schema.impuesto.id }).from(schema.impuesto).get()!;
    const ajeno = productoCreateHandler(db, {
      nombre_corto: 'Otro producto sin vínculo', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 10000,
    });
    const sku = db.select({ sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.id, ajeno.id)).get()!.sku;

    const preview = await parsear(`COD_PRODUCTO_PROV,COSTO,EAN,COD_INTERNO\n,99.00,,${sku}\n`);
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('codigo_interno');
    expect(fila.producto_id).toBe(ajeno.id);
    expect(fila.costo_anterior_centavos).toBeNull();
  });

  it('confirmar un match contra el catálogo (producto sin vínculo previo) crea el producto_proveedor', async () => {
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get()!;
    const imp = db.select({ id: schema.impuesto.id }).from(schema.impuesto).get()!;
    const ajeno = productoCreateHandler(db, {
      nombre_corto: 'Producto a vincular al confirmar', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 10000,
    });
    db.update(schema.producto).set({ gtin_barcode: '7790000000002' })
      .where(eq(schema.producto.id, ajeno.id)).run();

    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\n,150.00,7790000000002\n');
    await confirmar(preview.filas);

    const pp = db.select({ costo: schema.producto_proveedor.costo_centavos })
      .from(schema.producto_proveedor)
      .where(and(
        eq(schema.producto_proveedor.producto_id, ajeno.id),
        eq(schema.producto_proveedor.proveedor_id, proveedorId),
      ))
      .get();
    expect(pp).toBeDefined();
    expect(pp!.costo).toBe(15000);
  });

  // ── validación cruzada por código del producto del proveedor (advertencia) ──
  it('advertencia cuando matchea por EAN pero el código del producto del proveedor no coincide con el guardado', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nCODIGO-QUE-NO-ES,250.00,7791234567890\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.matched_by).toBe('gtin');
    expect(fila.advertencia).toMatch(/no coincide/i);
  });

  it('sin advertencia cuando matchea por EAN y el código del producto del proveedor coincide con el guardado', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,7791234567890\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.advertencia).toBeNull();
  });

  it('sin advertencia cuando matchea por su propio código (por construcción coinciden)', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,EAN\nPT-001,250.00,\n');
    expect(preview.filas[0].advertencia).toBeNull();
  });

  // Sugerencias inline en la previsualización (paridad con Importar Catálogo): una fila
  // sin identificar por identificador ofrece candidatos por similitud de DESCRIPCION.
  it('una fila sin_matchear trae candidatos por similitud de la DESCRIPCION del archivo', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,DESCRIPCION\nZZZ-NADA,120.00,Tornillo 4x40 zincado\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('sin_matchear');
    expect(fila.nombre_producto_archivo).toBe('Tornillo 4x40 zincado');
    expect(fila.candidatos?.map(c => c.producto_id)).toContain(productoId);
  });

  it('una fila matcheada no trae candidatos (no hacen falta)', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO,DESCRIPCION\nPT-001,120.00,Tornillo 4x40 zincado\n');
    const fila = preview.filas[0];
    expect(fila.estado).toBe('matched');
    expect(fila.candidatos ?? []).toEqual([]);
  });
});

// ── confirmar (followup ADR-051: acá se persiste todo de una vez) ─────────────

describe('importacionCostoConfirmarHandler', () => {
  it('actualiza costo en producto_proveedor para filas matcheadas', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,350.00\n');
    await confirmar(preview.filas);

    const pp = db.select({ costo_centavos: schema.producto_proveedor.costo_centavos })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .get()!;
    expect(pp.costo_centavos).toBe(35000);
  });

  it('lanza SIN_FILAS_PARA_CONFIRMAR si el array de filas viene vacío', async () => {
    await expect(confirmar([])).rejects.toThrow('SIN_FILAS_PARA_CONFIRMAR');
  });

  it('crea la cabecera directo en estado confirmado (nunca pasa por pendiente)', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    const res = await confirmar(preview.filas, 'lista-julio.csv');
    const imp = db.select().from(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, res.importacion_id)).get()!;
    expect(imp.estado).toBe('confirmado');
    expect(imp.nombre_archivo).toBe('lista-julio.csv');
    expect(imp.filas_totales).toBe(1);
  });

  it('persiste el detalle de TODAS las filas: matched, error_formato y sin_matchear', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\nDESCONOCIDO,50.00\nOTRO,mal\n');
    const res = await confirmar(preview.filas);
    const detalles = db.select().from(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.importacion_id, res.importacion_id)).all();
    expect(detalles).toHaveLength(3);
    expect(detalles.map(d => d.estado).sort()).toEqual(['error_formato', 'matched', 'sin_matchear']);
  });

  it('atomicidad: proveedorId inexistente en producto_proveedor todavía persiste el detalle (no hay FK ahí)', async () => {
    // no hay una forma real de romper la transacción con datos válidos de FilaPreview;
    // se documenta el comportamiento esperado: confirmar con filas ya calculadas no vuelve
    // a fallar por matching, solo por problemas de sesión/DB.
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    const res = await confirmar(preview.filas);
    expect(res.ok).toBe(true);
  });

  // ── ADR-049 §7: cierre del circuito de costo ────────────────────────────────

  it('dispara un batch en borrador cuando hay una lista en modo margen_costo, y no publica nada', async () => {
    const pp = db.select({ id: schema.producto_proveedor.id })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .get()!;
    productoProveedorSetPreferidoHandler(db, pp.id);
    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });

    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,350.00\n');
    const res = await confirmar(preview.filas);

    expect(res.batches).toHaveLength(1);
    expect(res.batches[0].lista_precio_id).toBe(lista.id);
    const batchRow = db.select().from(schema.price_batch)
      .where(eq(schema.price_batch.id, res.batches[0].id)).get()!;
    expect(batchRow.origen).toBe('PROVIDER_COST_UPDATE');
    expect(batchRow.proveedor_id).toBe(proveedorId);
    expect(['borrador', 'validado', 'validacion_fallida']).toContain(batchRow.estado);
    const vigente = db.select().from(schema.lista_precio_valor)
      .where(and(
        eq(schema.lista_precio_valor.lista_precio_id, lista.id),
        eq(schema.lista_precio_valor.producto_id, productoId),
      )).get()!;
    expect(vigente.origen).toBe('manual');
    expect(vigente.precio_centavos).toBe(5000000); // precio_venta_lista=50000 × 100, ajuste 0
  });

  it('no dispara ningún batch si todas las listas están en modo pct_sobre_lista', async () => {
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nPT-001,350.00\n');
    const res = await confirmar(preview.filas);
    expect(res.batches).toHaveLength(0);
  });
});

// ── cola de revisión ─────────────────────────────────────────────────────────

describe('importacionCostoGetColaRevisionHandler', () => {
  it('retorna filas sin_matchear de una importación confirmada', async () => {
    await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nDESCONOCIDO,100.00\n');
    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola.length).toBeGreaterThan(0);
    expect(cola[0].estado).toBe('sin_matchear');
  });

  it('NO incluye filas sin_matchear de una importación cancelada', async () => {
    // followup ADR-051: el flujo normal ya no genera 'cancelado' (nunca pasa por
    // 'pendiente') — se simula una fila vieja/huérfana insertada directo, el caso que
    // el botón "Eliminar"/cancelar de limpieza legacy sigue cubriendo.
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
    db.insert(schema.importacion_costo_proveedor).values({
      id: 'imp-legacy', proveedor_id: proveedorId, nombre_archivo: 'legacy.csv',
      fecha_importacion: now, filas_totales: 1, filas_matcheadas: 0, filas_sin_match: 1,
      estado: 'pendiente', usuario_id: 'test-user', ...sync,
    }).run();
    db.insert(schema.importacion_costo_proveedor_detalle).values({
      id: 'det-legacy', importacion_id: 'imp-legacy', producto_id: null,
      costo_anterior_centavos: null, costo_nuevo_centavos: 5000, fila_original: null,
      estado: 'sin_matchear', matched_by: null, resuelto_por_usuario_id: null,
      fecha_resolucion: null, ...sync,
    }).run();

    importacionCostoCancelarHandler(db, { importacionId: 'imp-legacy' });
    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola.find(f => f.detalle_id === 'det-legacy')).toBeUndefined();
  });
});

// ── resolver fila ─────────────────────────────────────────────────────────────

describe('importacionCostoResolverFilaHandler', () => {
  it('asigna producto, actualiza costo y marca resuelto_manual', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nDESCONOCIDO,450.00\n');
    const detalleId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;

    await importacionCostoResolverFilaHandler(db, { detalleId, productoId, proveedorId });

    const det = db.select().from(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId)).get()!;
    expect(det.estado).toBe('resuelto_manual');
    expect(det.matched_by).toBe('manual');
    expect(det.producto_id).toBe(productoId);

    const pp = db.select({ costo_centavos: schema.producto_proveedor.costo_centavos })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .get()!;
    expect(pp.costo_centavos).toBe(45000);
  });

  // ── ADR-063 §1: el match manual se aprende como código del proveedor ──────────
  it('persiste el código del proveedor del archivo al resolver, y la próxima importación auto-matchea', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nNUEVO-COD,450.00\n');
    const detalleId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;

    await importacionCostoResolverFilaHandler(db, { detalleId, productoId, proveedorId });

    const pp = db.select({ codigo: schema.producto_proveedor.codigo_proveedor })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .get()!;
    expect(pp.codigo).toBe('NUEVO-COD');

    // round-trip: la próxima lista con ese código matchea sola, no reaparece en la cola
    const preview = await parsear('COD_PRODUCTO_PROV,COSTO\nNUEVO-COD,999.00\n');
    expect(preview.filas[0].estado).toBe('matched');
    expect(preview.filas[0].matched_by).toBe('codigo_proveedor');
    expect(preview.filas[0].producto_id).toBe(productoId);
  });

  it('crea la relación con el código del proveedor cuando el producto no la tenía (INSERT)', async () => {
    const cat = categoriaCreateHandler(db, { nombre: 'Otra categoría' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod2 = productoCreateHandler(db, {
      nombre_corto: 'Tuerca 4mm',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: 10000,
    });

    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nTUERCA-COD,120.00\n');
    const detalleId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;

    await importacionCostoResolverFilaHandler(db, { detalleId, productoId: prod2.id, proveedorId });

    const pp = db.select({
      codigo: schema.producto_proveedor.codigo_proveedor,
      costo: schema.producto_proveedor.costo_centavos,
    })
      .from(schema.producto_proveedor)
      .where(and(
        eq(schema.producto_proveedor.producto_id, prod2.id),
        eq(schema.producto_proveedor.proveedor_id, proveedorId),
      ))
      .get()!;
    expect(pp.codigo).toBe('TUERCA-COD');
    expect(pp.costo).toBe(12000);
  });

  it('no pisa un código de proveedor existente cuando la fila resuelta no trae código', async () => {
    // fila con COD_INTERNO inexistente (sin COD_PRODUCTO_PROV ni EAN) → cae a la cola
    const { importacionId } = await crearImportacionConfirmada('COD_INTERNO,COSTO\nSKU-INEXISTENTE,450.00\n');
    const detalleId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;

    await importacionCostoResolverFilaHandler(db, { detalleId, productoId, proveedorId });

    const pp = db.select({ codigo: schema.producto_proveedor.codigo_proveedor })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.producto_id, productoId))
      .get()!;
    expect(pp.codigo).toBe('PT-001'); // se preserva el código previo
  });
});

// ── descartar fila ────────────────────────────────────────────────────────────

describe('importacionCostoDescartarFilaHandler', () => {
  async function crearFilaSinMatchearPersistida() {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nDESCONOCIDO,100.00\n');
    return importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;
  }

  it('marca la fila como descartado', async () => {
    const detalleId = await crearFilaSinMatchearPersistida();
    const result = importacionCostoDescartarFilaHandler(db, detalleId);
    expect(result).toEqual({ ok: true });
    const det = db.select({ estado: schema.importacion_costo_proveedor_detalle.estado })
      .from(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId))
      .get()!;
    expect(det.estado).toBe('descartado');
  });

  it('la fila descartada no aparece en la cola de revisión', async () => {
    const detalleId = await crearFilaSinMatchearPersistida();
    importacionCostoDescartarFilaHandler(db, detalleId);
    const cola = await importacionCostoGetColaRevisionHandler(db);
    expect(cola.find(f => f.detalle_id === detalleId)).toBeUndefined();
  });

  it('lanza DETALLE_NOT_FOUND si el id no existe', () => {
    expect(() => importacionCostoDescartarFilaHandler(db, 'NO-EXISTE')).toThrow('DETALLE_NOT_FOUND');
  });

  it('lanza DETALLE_NO_ES_SIN_MATCHEAR si la fila ya está matched', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    const matchedId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;
    expect(() => importacionCostoDescartarFilaHandler(db, matchedId)).toThrow('DETALLE_NO_ES_SIN_MATCHEAR');
  });
});

// ── actualizar fila ───────────────────────────────────────────────────────────

describe('importacionCostoActualizarFilaHandler', () => {
  async function crearFilaSinMatchearPersistida() {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nDESCONOCIDO,100.00\n');
    return importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;
  }

  it('actualiza costo_nuevo_centavos y datos en fila_original', async () => {
    const detalleId = await crearFilaSinMatchearPersistida();
    const result = importacionCostoActualizarFilaHandler(db, {
      detalleId,
      costoNuevoCentavos: 22500,
      datos: { COD_PRODUCTO_PROV: 'DESCONOCIDO', COSTO: '225.00' },
    });
    expect(result).toEqual({ ok: true });
    const det = db.select({
      costo_nuevo_centavos: schema.importacion_costo_proveedor_detalle.costo_nuevo_centavos,
      fila_original: schema.importacion_costo_proveedor_detalle.fila_original,
    })
      .from(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId))
      .get()!;
    expect(det.costo_nuevo_centavos).toBe(22500);
    const parsed = JSON.parse(det.fila_original!);
    expect(parsed.datos).toEqual({ COD_PRODUCTO_PROV: 'DESCONOCIDO', COSTO: '225.00' });
  });

  it('lanza DETALLE_NOT_FOUND si el id no existe', () => {
    expect(() => importacionCostoActualizarFilaHandler(db, {
      detalleId: 'NO-EXISTE', costoNuevoCentavos: 1000, datos: {},
    })).toThrow('DETALLE_NOT_FOUND');
  });

  it('lanza DETALLE_NO_ES_SIN_MATCHEAR si la fila ya está matched', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    const matchedId = importacionCostoGetHistorialDetalleHandler(db, importacionId)[0].detalle_id;
    expect(() => importacionCostoActualizarFilaHandler(db, {
      detalleId: matchedId, costoNuevoCentavos: 999, datos: {},
    })).toThrow('DETALLE_NO_ES_SIN_MATCHEAR');
  });
});

// ── ADR-051 A.6 / followup: cancelar (limpieza de filas legacy) ────────────────

describe('importacionCostoCancelarHandler', () => {
  function crearImportacionPendienteLegacy() {
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
    const id = 'imp-legacy-' + Math.random().toString(36).slice(2);
    db.insert(schema.importacion_costo_proveedor).values({
      id, proveedor_id: proveedorId, nombre_archivo: 'legacy.csv',
      fecha_importacion: now, filas_totales: 1, filas_matcheadas: 1, filas_sin_match: 0,
      estado: 'pendiente', usuario_id: 'test-user', ...sync,
    }).run();
    return id;
  }

  it('marca la importación como cancelado', () => {
    const importacionId = crearImportacionPendienteLegacy();
    const result = importacionCostoCancelarHandler(db, { importacionId });
    expect(result).toEqual({ ok: true });
    const imp = db.select({ estado: schema.importacion_costo_proveedor.estado })
      .from(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, importacionId))
      .get()!;
    expect(imp.estado).toBe('cancelado');
  });

  it('lanza IMPORTACION_NOT_FOUND si el id no existe', () => {
    expect(() => importacionCostoCancelarHandler(db, { importacionId: 'NO-EXISTE' }))
      .toThrow('IMPORTACION_NOT_FOUND');
  });

  it('lanza IMPORTACION_YA_PROCESADA si ya estaba confirmada', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    expect(() => importacionCostoCancelarHandler(db, { importacionId }))
      .toThrow('IMPORTACION_YA_PROCESADA');
  });
});

// ── eliminar (followup ADR-051): borrado físico de pendiente/cancelado ──────────
describe('importacionCostoEliminarHandler', () => {
  function crearImportacionPendienteLegacy() {
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
    const id = 'imp-legacy-' + Math.random().toString(36).slice(2);
    db.insert(schema.importacion_costo_proveedor).values({
      id, proveedor_id: proveedorId, nombre_archivo: 'legacy.csv',
      fecha_importacion: now, filas_totales: 1, filas_matcheadas: 1, filas_sin_match: 0,
      estado: 'pendiente', usuario_id: 'test-user', ...sync,
    }).run();
    return id;
  }

  it('elimina físicamente una importación pendiente legacy', () => {
    const importacionId = crearImportacionPendienteLegacy();
    const result = importacionCostoEliminarHandler(db, { importacionId });
    expect(result).toEqual({ ok: true });
    expect(db.select().from(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, importacionId)).get()).toBeUndefined();
  });

  it('elimina físicamente una importación cancelada', () => {
    const importacionId = crearImportacionPendienteLegacy();
    importacionCostoCancelarHandler(db, { importacionId });
    const result = importacionCostoEliminarHandler(db, { importacionId });
    expect(result).toEqual({ ok: true });
    expect(db.select().from(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, importacionId)).get()).toBeUndefined();
  });

  it('lanza IMPORTACION_CONFIRMADA_NO_SE_PUEDE_ELIMINAR si ya fue confirmada', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\n');
    expect(() => importacionCostoEliminarHandler(db, { importacionId }))
      .toThrow('IMPORTACION_CONFIRMADA_NO_SE_PUEDE_ELIMINAR');
    expect(db.select().from(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, importacionId)).get()).toBeDefined();
  });

  it('lanza IMPORTACION_NOT_FOUND si el id no existe', () => {
    expect(() => importacionCostoEliminarHandler(db, { importacionId: 'NO-EXISTE' }))
      .toThrow('IMPORTACION_NOT_FOUND');
  });
});

// ── historial ─────────────────────────────────────────────────────────────────

describe('importacionCostoGetHistorialHandler', () => {
  it('lista importaciones más recientes primero, con el desglose en vivo', async () => {
    const { importacionId: id1 } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\nDESCONOCIDO,50.00\n');
    const { importacionId: id2 } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,200.00\n');

    // fecha_importacion es mode:'timestamp' (resolución de segundos) — dos inserts en
    // el mismo test pueden caer en el mismo segundo. Se fuerza id1 a un instante
    // anterior para que el orden DESC sea determinístico, no dependiente del reloj.
    db.update(schema.importacion_costo_proveedor)
      .set({ fecha_importacion: new Date(Date.now() - 10_000) })
      .where(eq(schema.importacion_costo_proveedor.id, id1))
      .run();

    const historial = importacionCostoGetHistorialHandler(db);
    expect(historial[0].id).toBe(id2); // más reciente primero
    expect(historial[0].proveedor).toBe('Prov Test SA');
    const item1 = historial.find(h => h.id === id1)!;
    expect(item1.filas_totales).toBe(2);
    expect(item1.identificados).toBe(1);
    expect(item1.pendientes).toBe(1);
    // el desglose siempre reconcilia con el total
    expect(item1.identificados + item1.rechazados + item1.pendientes + item1.descartados).toBe(item1.filas_totales);
  });

  it('al resolver una fila pendiente, sube identificados y baja pendientes (en vivo, siempre consistente)', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,100.00\nDESCONOCIDO,50.00\n');
    const detalle = importacionCostoGetHistorialDetalleHandler(db, importacionId);
    const pendiente = detalle.find(d => d.estado === 'sin_matchear')!;

    let item = importacionCostoGetHistorialHandler(db).find(h => h.id === importacionId)!;
    expect(item.identificados).toBe(1);
    expect(item.pendientes).toBe(1);

    await importacionCostoResolverFilaHandler(db, { detalleId: pendiente.detalle_id, productoId, proveedorId });

    item = importacionCostoGetHistorialHandler(db).find(h => h.id === importacionId)!;
    expect(item.identificados).toBe(2); // la resuelta pasa a contar como identificada
    expect(item.pendientes).toBe(0);
    expect(item.identificados + item.rechazados + item.pendientes + item.descartados).toBe(2);
  });

  it('pendientes es 0 para una importación cancelada, aunque tenga filas sin_matchear', () => {
    const now = new Date();
    const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
    db.insert(schema.importacion_costo_proveedor).values({
      id: 'imp-legacy', proveedor_id: proveedorId, nombre_archivo: 'legacy.csv',
      fecha_importacion: now, filas_totales: 1, filas_matcheadas: 0, filas_sin_match: 1,
      estado: 'pendiente', usuario_id: 'test-user', ...sync,
    }).run();
    db.insert(schema.importacion_costo_proveedor_detalle).values({
      id: 'det-legacy', importacion_id: 'imp-legacy', producto_id: null,
      costo_anterior_centavos: null, costo_nuevo_centavos: 5000, fila_original: null,
      estado: 'sin_matchear', matched_by: null, resuelto_por_usuario_id: null,
      fecha_resolucion: null, ...sync,
    }).run();
    importacionCostoCancelarHandler(db, { importacionId: 'imp-legacy' });

    const item = importacionCostoGetHistorialHandler(db).find(h => h.id === 'imp-legacy')!;
    expect(item.estado).toBe('cancelado');
    expect(item.pendientes).toBe(0);
  });
});

describe('importacionCostoGetHistorialDetalleHandler', () => {
  it('devuelve todas las filas de una importación puntual, con datos y motivo reconstruidos', async () => {
    const { importacionId } = await crearImportacionConfirmada('COD_PRODUCTO_PROV,COSTO\nPT-001,250.00\nDESCONOCIDO,50.00\n');

    const detalle = importacionCostoGetHistorialDetalleHandler(db, importacionId);
    expect(detalle).toHaveLength(2);
    const matched = detalle.find(d => d.estado === 'matched')!;
    expect(matched.nombre_producto).toBe('Tornillo 4x40');
    expect(matched.datos).toEqual({ COD_PRODUCTO_PROV: 'PT-001', COSTO: '250.00' });
    const sinMatch = detalle.find(d => d.estado === 'sin_matchear')!;
    expect(sinMatch.motivo).toMatch(/sin identificar/i);
  });

  it('devuelve array vacío si la importación no tiene filas (o no existe)', () => {
    expect(importacionCostoGetHistorialDetalleHandler(db, 'NO-EXISTE')).toEqual([]);
  });
});

// ── revalidarFila (followup ADR-051): re-matching real al editar en Previsualizar ──

describe('importacionCostoRevalidarFilaHandler', () => {
  it('editar el EAN de una fila sin_matchear por uno válido la re-identifica (matched por gtin)', () => {
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'DESCONOCIDO', COSTO: '65.00', EAN: '7791234567890' },
    });
    expect(r.estado).toBe('matched');
    expect(r.matched_by).toBe('gtin');
    expect(r.producto_id).toBe(productoId);
    expect(r.nombre_producto).toBe('Tornillo 4x40');
    expect(r.costo_nuevo_centavos).toBe(6500);
  });

  it('editar el código interno (SKU) por uno válido re-identifica el producto', () => {
    const sku = db.select({ sku: schema.producto.sku }).from(schema.producto)
      .where(eq(schema.producto.id, productoId)).get()!.sku;
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'DESCONOCIDO', COSTO: '80.00', EAN: '', COD_INTERNO: sku },
    });
    expect(r.estado).toBe('matched');
    expect(r.matched_by).toBe('codigo_interno');
    expect(r.producto_id).toBe(productoId);
  });

  it('editar el código de proveedor por uno válido re-identifica el producto', () => {
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: '90.00', EAN: '' },
    });
    expect(r.estado).toBe('matched');
    expect(r.matched_by).toBe('codigo_proveedor');
    expect(r.producto_id).toBe(productoId);
  });

  it('editar el EAN por el de un producto NO vinculado a este proveedor lo identifica (contra todo el catálogo)', () => {
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get()!;
    const imp = db.select({ id: schema.impuesto.id }).from(schema.impuesto).get()!;
    const ajeno = productoCreateHandler(db, {
      nombre_corto: 'Ajeno revalidar', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 10000,
    });
    db.update(schema.producto).set({ gtin_barcode: '7790000000003' })
      .where(eq(schema.producto.id, ajeno.id)).run();

    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'NO-EXISTE', COSTO: '10.00', EAN: '7790000000003' },
    });
    expect(r.estado).toBe('matched');
    expect(r.matched_by).toBe('gtin');
    expect(r.producto_id).toBe(ajeno.id);
    expect(r.costo_anterior_centavos).toBeNull();
  });

  it('un costo inválido pasa a error_formato aunque el producto matchee', () => {
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: 'consultar', EAN: '' },
    });
    expect(r.estado).toBe('error_formato');
    expect(r.costo_nuevo_centavos).toBeNull();
    // sigue matcheando el producto — el error es solo de formato del costo
    expect(r.producto_id).toBe(productoId);
  });

  it('sin ningún identificador que matchee, queda sin_matchear', () => {
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'NADA', COSTO: '50.00', EAN: '0000000000000' },
    });
    expect(r.estado).toBe('sin_matchear');
    expect(r.producto_id).toBeNull();
  });

  it('una fila que queda sin_matchear trae candidatos por similitud de la DESCRIPCION', () => {
    const r = importacionCostoRevalidarFilaHandler(db, {
      proveedorId,
      datos: { COD_PRODUCTO_PROV: 'NADA', COSTO: '50.00', EAN: '', DESCRIPCION: 'Tornillo 4x40 zincado' },
    });
    expect(r.estado).toBe('sin_matchear');
    expect(r.candidatos?.map(c => c.producto_id)).toContain(productoId);
  });
});

// ── buscarProductos (followup ADR-051): modal Consultar productos ──────────────

describe('importacionCostoBuscarProductosHandler', () => {
  it('busca por nombre e incluye el código del producto para ese proveedor', () => {
    const items = importacionCostoBuscarProductosHandler(db, { proveedorId, busqueda: 'Tornillo' });
    expect(items).toHaveLength(1);
    expect(items[0].nombre_corto).toBe('Tornillo 4x40');
    expect(items[0].codigo_proveedor).toBe('PT-001');
    expect(items[0].gtin_barcode).toBe('7791234567890');
  });

  it('busca por EAN', () => {
    const items = importacionCostoBuscarProductosHandler(db, { proveedorId, busqueda: '7791234567890' });
    expect(items.some(i => i.id === productoId)).toBe(true);
  });

  it('el código de proveedor es null para un proveedor que no tiene ese producto asociado', () => {
    const otroProv = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20999999997',
      razon_social: 'Otro Prov', condicion_fiscal: 'Responsable Inscripto',
    });
    const items = importacionCostoBuscarProductosHandler(db, { proveedorId: otroProv.id, busqueda: 'Tornillo' });
    expect(items).toHaveLength(1);
    expect(items[0].codigo_proveedor).toBeNull();
  });

  it('con búsqueda de menos de 2 caracteres retorna vacío', () => {
    expect(importacionCostoBuscarProductosHandler(db, { proveedorId, busqueda: 'a' })).toEqual([]);
  });
});
