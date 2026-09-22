import * as fs from 'node:fs';
import ExcelJS from 'exceljs';
import { eq, and, isNull, inArray, desc, or, sql } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession, getOriginId, requirePermission } from '@core/main';
import { parseCsvContent, mapearFila, HEADERS_FIJOS } from './importacion-costo.parser';
import { crearBatchesPorEventoDeCosto } from '../precios/motor';
import { crearMatcher, type CandidatoSimilitud } from '../matching/producto-matcher';

type Db = BetterSQLite3Database<typeof schema>;

// Importación de catálogo de proveedor (relación producto↔proveedor). A diferencia de
// Importar Costos (que solo actualiza el costo de productos YA vinculados), acá el
// objetivo es ESTABLECER el vínculo: qué productos vende este proveedor y con qué código.
// Por eso el matching es GLOBAL (todo el catálogo, no scoped al proveedor).
//
// Reglas (acordadas con el PO):
//  - Matchea el producto por EAN → código interno (SKU nuestro). El COD_PRODUCTO_PROV NO
//    se usa para matchear: es el dato que se guarda.
//  - No crea productos: una fila cuyo producto no existe queda 'sin_matchear'.
//  - Al confirmar hace upsert de producto_proveedor (código + costo opcional).
//  - "Preferido" NO se toca salvo que el producto no tenga NINGÚN preferido: en ese caso
//    el primer proveedor que se asocia queda preferido (no destructivo, nunca pisa).

export type CatalogoAccion = 'crear' | 'actualizar' | 'sin_matchear' | 'error';

export type FilaCatalogoPreview = {
  fila_num: number;
  gtin_archivo: string | null;
  codigo_producto_prov: string | null;
  codigo_interno_archivo: string | null;
  producto_id: string | null;
  nombre_producto: string | null;
  sku_producto: string | null;
  matched_by: 'gtin' | 'codigo_interno' | 'similitud' | null;
  costo_centavos: number | null;
  costo_anterior_centavos: number | null;
  accion: CatalogoAccion;
  motivo: string | null;
  datos: Record<string, string>;
  // ADR-063 Lote 4: nombre del producto en el archivo + candidatos por similitud
  // (sólo se completan en filas sin_matchear, para ofrecer un match por nombre).
  nombre_producto_archivo: string | null;
  candidatos: CandidatoSimilitud[];
};

export type PreviewCatalogo = {
  filas: FilaCatalogoPreview[];
  total_crear: number;
  total_actualizar: number;
};

type LookupsCatalogo = {
  porGtin: Map<string, { productoId: string; nombre: string; sku: string }>;
  porSku: Map<string, { productoId: string; nombre: string; sku: string }>;
  // vínculos existentes de ESTE proveedor: productoId → { costo, codigo }
  vinculados: Map<string, { costo: number; codigo: string | null }>;
};

// Lookups GLOBALES de productos (todo el catálogo activo) + los vínculos existentes de
// este proveedor (para distinguir "crear" de "actualizar" y mostrar el costo anterior).
function construirLookupsCatalogo(db: Db, proveedorId: string): LookupsCatalogo {
  const porGtin = new Map<string, { productoId: string; nombre: string; sku: string }>();
  const porSku = new Map<string, { productoId: string; nombre: string; sku: string }>();
  const prods = db.select({
    id:           schema.producto.id,
    sku:          schema.producto.sku,
    gtin_barcode: schema.producto.gtin_barcode,
    nombre_corto: schema.producto.nombre_corto,
  })
    .from(schema.producto)
    .where(eq(schema.producto.activo, true))
    .all();

  for (const p of prods) {
    const entry = { productoId: p.id, nombre: p.nombre_corto, sku: p.sku };
    if (p.gtin_barcode) porGtin.set(p.gtin_barcode.trim(), entry);
    if (p.sku) porSku.set(p.sku.trim().toUpperCase(), entry);
  }

  const vinculados = new Map<string, { costo: number; codigo: string | null }>();
  db.select({
    producto_id:      schema.producto_proveedor.producto_id,
    costo_centavos:   schema.producto_proveedor.costo_centavos,
    codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
  })
    .from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.proveedor_id, proveedorId),
      isNull(schema.producto_proveedor.deleted_at),
    ))
    .all()
    .forEach(v => vinculados.set(v.producto_id, { costo: v.costo_centavos, codigo: v.codigo_proveedor }));

  return { porGtin, porSku, vinculados };
}

function matchearCatalogo(
  mapped: { gtin_archivo: string | null; codigo_proveedor_archivo: string | null; codigo_interno_archivo: string | null; costo_centavos: number | null },
  rawCostoNoVacio: boolean,
  lookups: LookupsCatalogo,
): Pick<FilaCatalogoPreview, 'producto_id' | 'nombre_producto' | 'sku_producto' | 'matched_by' | 'costo_centavos' | 'costo_anterior_centavos' | 'accion' | 'motivo'> {
  let matched_by: FilaCatalogoPreview['matched_by'] = null;
  let hit: { productoId: string; nombre: string; sku: string } | undefined;

  if (mapped.gtin_archivo) {
    hit = lookups.porGtin.get(mapped.gtin_archivo);
    if (hit) matched_by = 'gtin';
  }
  if (!hit && mapped.codigo_interno_archivo) {
    hit = lookups.porSku.get(mapped.codigo_interno_archivo.toUpperCase());
    if (hit) matched_by = 'codigo_interno';
  }

  // El costo es OPCIONAL, pero si vino algo escrito y no es número, es un error.
  const costoInvalido = rawCostoNoVacio && mapped.costo_centavos === null;

  let accion: CatalogoAccion;
  let motivo: string | null = null;
  let costoAnterior: number | null = null;

  if (!hit) {
    accion = 'sin_matchear';
    motivo = 'El producto no está en el catálogo — creá el producto primero.';
  } else if (!mapped.codigo_proveedor_archivo) {
    accion = 'error';
    motivo = `Falta el código del producto del proveedor (${HEADERS_FIJOS.codigoProveedor}).`;
  } else if (costoInvalido) {
    accion = 'error';
    motivo = 'Costo no es un número válido.';
  } else {
    const vinculo = lookups.vinculados.get(hit.productoId);
    accion = vinculo ? 'actualizar' : 'crear';
    costoAnterior = vinculo ? vinculo.costo : null;
  }

  return {
    producto_id: hit ? hit.productoId : null,
    nombre_producto: hit ? hit.nombre : null,
    sku_producto: hit ? hit.sku : null,
    matched_by,
    costo_centavos: mapped.costo_centavos,
    costo_anterior_centavos: costoAnterior,
    accion,
    motivo,
  };
}

function leerArchivoTabular(filePath: string): { headers: Map<string, number>; rows: string[][] } {
  if (filePath.toLowerCase().endsWith('.xlsx')) {
    // Nota: exceljs.readFile es async; se resuelve en el handler antes de llamar acá no
    // aplica — por eso el parse de xlsx se hace inline en el handler. Esta función es solo
    // para CSV. (Ver handler.)
    throw new Error('XLSX se lee en el handler');
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCsvContent(content);
}

export async function importacionCatalogoParseArchivoHandler(
  db: Db,
  { filePath, proveedorId }: { filePath: string; proveedorId: string },
): Promise<PreviewCatalogo> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  let headers: Map<string, number>;
  let rows: string[][];
  if (filePath.toLowerCase().endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.worksheets[0];
    if (!ws) throw new Error('XLSX_EMPTY');
    const allRows: string[][] = [];
    ws.eachRow((row) => {
      allRows.push((row.values as (ExcelJS.CellValue | null)[]).slice(1).map(v => v === null || v === undefined ? '' : String(v)));
    });
    const headerRow = allRows[0] ?? [];
    headers = new Map<string, number>();
    headerRow.forEach((h, i) => { if (h) headers.set(h.trim().toUpperCase(), i); });
    rows = allRows.slice(1).filter(r => r.some(c => c.trim()));
  } else {
    const parsed = leerArchivoTabular(filePath);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  const lookups = construirLookupsCatalogo(db, proveedorId);
  const costoKey = HEADERS_FIJOS.costo;
  const filas: FilaCatalogoPreview[] = [];
  // ADR-063 Lote 4: matcher armado una sola vez para sugerir candidatos por nombre en las
  // filas que no matchearon por EAN/código.
  const matcher = crearMatcher(db);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapearFila(row, headers);

    const rawRow: Record<string, string> = {};
    for (const [header, idx] of headers.entries()) rawRow[header] = row[idx] ?? '';
    const rawCostoNoVacio = (rawRow[costoKey] ?? '').trim() !== '';

    const match = matchearCatalogo(mapped, rawCostoNoVacio, lookups);
    const candidatos = (match.accion === 'sin_matchear' && mapped.nombre_archivo)
      ? matcher.sugerir(mapped.nombre_archivo)
      : [];
    filas.push({
      fila_num: i + 1,
      gtin_archivo: mapped.gtin_archivo,
      codigo_producto_prov: mapped.codigo_proveedor_archivo,
      codigo_interno_archivo: mapped.codigo_interno_archivo,
      datos: rawRow,
      nombre_producto_archivo: mapped.nombre_archivo,
      candidatos,
      ...match,
    });
  }

  return {
    filas,
    total_crear: filas.filter(f => f.accion === 'crear').length,
    total_actualizar: filas.filter(f => f.accion === 'actualizar').length,
  };
}

export type RevalidarFilaCatalogoPayload = { proveedorId: string; datos: Record<string, string> };

export function importacionCatalogoRevalidarFilaHandler(
  db: Db,
  { proveedorId, datos }: RevalidarFilaCatalogoPayload,
): Omit<FilaCatalogoPreview, 'fila_num' | 'datos'> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const columnas = Object.keys(datos);
  const headers = new Map<string, number>();
  columnas.forEach((h, i) => headers.set(h.toUpperCase(), i));
  const row = columnas.map(h => datos[h]);

  const mapped = mapearFila(row, headers);
  const rawCostoNoVacio = (datos[Object.keys(datos).find(k => k.toUpperCase() === HEADERS_FIJOS.costo) ?? ''] ?? '').trim() !== '';
  const lookups = construirLookupsCatalogo(db, proveedorId);
  const match = matchearCatalogo(mapped, rawCostoNoVacio, lookups);
  // ADR-063 Lote 4: si sigue sin matchear, recomputa candidatos por nombre.
  const candidatos = (match.accion === 'sin_matchear' && mapped.nombre_archivo)
    ? crearMatcher(db).sugerir(mapped.nombre_archivo)
    : [];

  return {
    gtin_archivo: mapped.gtin_archivo,
    codigo_producto_prov: mapped.codigo_proveedor_archivo,
    codigo_interno_archivo: mapped.codigo_interno_archivo,
    nombre_producto_archivo: mapped.nombre_archivo,
    candidatos,
    ...match,
  };
}

export type ConfirmarCatalogoPayload = { proveedorId: string; nombreArchivo: string; filas: FilaCatalogoPreview[] };
// ADR-054: cada fila del preview enriquecida con si este proveedor quedó preferido del
// producto (para la tabla de impactados y el chip "Preferido" del renderer).
export type FilaCatalogoConfirmada = FilaCatalogoPreview & { preferido_asignado: boolean };
export type ConfirmarCatalogoResultado = {
  ok: true;
  importacion_id: string;
  creados: number;
  actualizados: number;
  sin_identificar: number;
  errores: number;
  preferidos_asignados: number;
  filas: FilaCatalogoConfirmada[];
};

export function importacionCatalogoConfirmarHandler(
  db: Db,
  { proveedorId, nombreArchivo, filas }: ConfirmarCatalogoPayload,
): ConfirmarCatalogoResultado {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const importacionId = generateId();

  let creados = 0, actualizados = 0, preferidosAsignados = 0;
  const productosAfectados: string[] = [];
  // Se persiste UNA fila de detalle por cada fila del preview (incluidas sin_matchear/error),
  // en el mismo orden, para que el historial y la tabla de impactados sean completos.
  const filasConfirmadas: FilaCatalogoConfirmada[] = [];

  db.transaction(() => {
    for (const fila of filas) {
      const aplicable = (fila.accion === 'crear' || fila.accion === 'actualizar') && !!fila.producto_id && !!fila.codigo_producto_prov;
      if (!aplicable) {
        filasConfirmadas.push({ ...fila, preferido_asignado: false });
        continue;
      }
      const productoId = fila.producto_id!;

      const existing = db.select({ id: schema.producto_proveedor.id, costo: schema.producto_proveedor.costo_centavos })
        .from(schema.producto_proveedor)
        .where(and(
          eq(schema.producto_proveedor.producto_id, productoId),
          eq(schema.producto_proveedor.proveedor_id, proveedorId),
        ))
        .get();

      if (existing) {
        db.update(schema.producto_proveedor).set({
          codigo_proveedor: fila.codigo_producto_prov!,
          // costo opcional: si no vino, se conserva el que había
          ...(fila.costo_centavos !== null ? { costo_centavos: fila.costo_centavos } : {}),
          deleted_at: null,
          ...sync,
        }).where(eq(schema.producto_proveedor.id, existing.id)).run();
        actualizados++;
      } else {
        db.insert(schema.producto_proveedor).values({
          id:                  generateId(),
          producto_id:         productoId,
          proveedor_id:        proveedorId,
          costo_centavos:      fila.costo_centavos ?? 0,
          codigo_proveedor:    fila.codigo_producto_prov!,
          preferido:           false,
          usuario_creacion_id: session.userId,
          fecha_creacion:      now,
          ...sync,
        }).run();
        creados++;
      }

      // Preferido solo si el producto no tiene NINGUNO (no destructivo, nunca pisa).
      const tienePreferido = db.select({ id: schema.producto_proveedor.id })
        .from(schema.producto_proveedor)
        .where(and(
          eq(schema.producto_proveedor.producto_id, productoId),
          eq(schema.producto_proveedor.preferido, true),
          isNull(schema.producto_proveedor.deleted_at),
        ))
        .get();

      let preferidoAsignado = false;
      if (!tienePreferido) {
        db.update(schema.producto_proveedor)
          .set({ preferido: true, updated_at: now })
          .where(and(
            eq(schema.producto_proveedor.producto_id, productoId),
            eq(schema.producto_proveedor.proveedor_id, proveedorId),
            isNull(schema.producto_proveedor.deleted_at),
          ))
          .run();
        preferidosAsignados++;
        preferidoAsignado = true;
      }

      productosAfectados.push(productoId);
      filasConfirmadas.push({ ...fila, preferido_asignado: preferidoAsignado });
    }

    const sinMatch = filas.filter(f => f.accion === 'sin_matchear').length;
    const errores  = filas.filter(f => f.accion === 'error').length;

    // ADR-054: cabecera + detalle del historial de catálogos, en la misma transacción.
    db.insert(schema.importacion_catalogo_proveedor).values({
      id:                   importacionId,
      proveedor_id:         proveedorId,
      nombre_archivo:       nombreArchivo,
      fecha_importacion:    now,
      filas_totales:        filas.length,
      filas_creadas:        creados,
      filas_actualizadas:   actualizados,
      filas_sin_match:      sinMatch,
      filas_error:          errores,
      preferidos_asignados: preferidosAsignados,
      estado:               'confirmado',
      usuario_id:           session.userId,
      ...sync,
    }).run();

    for (const f of filasConfirmadas) {
      db.insert(schema.importacion_catalogo_proveedor_detalle).values({
        id:                      generateId(),
        importacion_id:          importacionId,
        producto_id:             f.producto_id,
        costo_centavos:          f.costo_centavos,
        costo_anterior_centavos: f.costo_anterior_centavos,
        codigo_producto_prov:    f.codigo_producto_prov,
        fila_original:           JSON.stringify({ fila_num: f.fila_num, datos: f.datos }),
        estado:                  f.accion,
        matched_by:              f.matched_by,
        preferido_asignado:      f.preferido_asignado,
        ...sync,
      }).run();
    }
  });

  // ADR-049 §7 — cambios de costo/preferido disparan batches en borrador (best-effort;
  // solo listas en modo margen_costo generan algo).
  if (productosAfectados.length > 0) {
    try {
      crearBatchesPorEventoDeCosto(db, {
        producto_ids: [...new Set(productosAfectados)],
        origen: 'SUPPLIER_CHANGE',
        proveedor_id: proveedorId,
        referencia_tipo: 'producto_proveedor',
        referencia_id: proveedorId,
      }, session.userId);
    } catch (e) {
      console.error('[precios] Error generando batch por importación de catálogo:', e);
    }
  }

  return {
    ok: true,
    importacion_id: importacionId,
    creados,
    actualizados,
    sin_identificar: filas.filter(f => f.accion === 'sin_matchear').length,
    errores: filas.filter(f => f.accion === 'error').length,
    preferidos_asignados: preferidosAsignados,
    filas: filasConfirmadas,
  };
}

// ── ADR-054: historial de catálogos + buscador de productos ─────────────────────

export type HistorialCatalogoItem = {
  id: string; proveedor: string; nombre_archivo: string; fecha_importacion: number;
  filas_totales: number; creados: number; actualizados: number; sin_match: number; errores: number;
  preferidos_asignados: number; estado: 'confirmado';
};

export function importacionCatalogoGetHistorialHandler(db: Db): HistorialCatalogoItem[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return db.select({
    id:                   schema.importacion_catalogo_proveedor.id,
    proveedor:            schema.proveedor.razon_social,
    nombre_archivo:       schema.importacion_catalogo_proveedor.nombre_archivo,
    fecha_importacion:    schema.importacion_catalogo_proveedor.fecha_importacion,
    filas_totales:        schema.importacion_catalogo_proveedor.filas_totales,
    filas_creadas:        schema.importacion_catalogo_proveedor.filas_creadas,
    filas_actualizadas:   schema.importacion_catalogo_proveedor.filas_actualizadas,
    filas_sin_match:      schema.importacion_catalogo_proveedor.filas_sin_match,
    filas_error:          schema.importacion_catalogo_proveedor.filas_error,
    preferidos_asignados: schema.importacion_catalogo_proveedor.preferidos_asignados,
    estado:               schema.importacion_catalogo_proveedor.estado,
  })
    .from(schema.importacion_catalogo_proveedor)
    .innerJoin(schema.proveedor, eq(schema.importacion_catalogo_proveedor.proveedor_id, schema.proveedor.id))
    .orderBy(desc(schema.importacion_catalogo_proveedor.fecha_importacion))
    .all()
    .map(r => ({
      id: r.id, proveedor: r.proveedor, nombre_archivo: r.nombre_archivo,
      fecha_importacion: r.fecha_importacion.getTime(),
      filas_totales: r.filas_totales, creados: r.filas_creadas, actualizados: r.filas_actualizadas,
      sin_match: r.filas_sin_match, errores: r.filas_error,
      preferidos_asignados: r.preferidos_asignados, estado: r.estado,
    }));
}

export type HistorialCatalogoDetalleFila = {
  detalle_id: string; fila_num: number; datos: Record<string, string>;
  nombre_producto: string | null; sku_producto: string | null;
  codigo_producto_prov: string | null;
  costo_centavos: number | null; costo_anterior_centavos: number | null;
  estado: 'crear' | 'actualizar' | 'sin_matchear' | 'error';
  preferido_asignado: boolean;
};

export function importacionCatalogoGetHistorialDetalleHandler(db: Db, importacionId: string): HistorialCatalogoDetalleFila[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const detalles = db.select()
    .from(schema.importacion_catalogo_proveedor_detalle)
    .where(eq(schema.importacion_catalogo_proveedor_detalle.importacion_id, importacionId))
    .all();

  const prodIds = [...new Set(detalles.map(d => d.producto_id).filter((id): id is string => !!id))];
  const infoPorId = new Map<string, { nombre: string; sku: string }>();
  if (prodIds.length > 0) {
    db.select({ id: schema.producto.id, nombre: schema.producto.nombre_corto, sku: schema.producto.sku })
      .from(schema.producto).where(inArray(schema.producto.id, prodIds)).all()
      .forEach(p => infoPorId.set(p.id, { nombre: p.nombre, sku: p.sku }));
  }

  return detalles.map(d => {
    let fila_num = 0; let datos: Record<string, string> = {};
    try { const p = JSON.parse(d.fila_original ?? '{}'); fila_num = p.fila_num ?? 0; datos = p.datos ?? {}; } catch { /* fila_original ausente/corrupto: no bloquea */ }
    const info = d.producto_id ? infoPorId.get(d.producto_id) : undefined;
    return {
      detalle_id: d.id, fila_num, datos,
      nombre_producto: info?.nombre ?? null, sku_producto: info?.sku ?? null,
      codigo_producto_prov: d.codigo_producto_prov,
      costo_centavos: d.costo_centavos, costo_anterior_centavos: d.costo_anterior_centavos,
      estado: d.estado, preferido_asignado: d.preferido_asignado,
    };
  });
}

export type ProductoConsultaCatalogo = {
  id: string; sku: string; gtin_barcode: string | null; nombre_corto: string; codigo_proveedor: string | null;
};

// Espejo de importacionCostoBuscarProductosHandler: búsqueda global por nombre/SKU/EAN,
// mostrando el código que ESTE proveedor tiene para el producto (si ya está vinculado).
export function importacionCatalogoBuscarProductosHandler(
  db: Db, { proveedorId, busqueda }: { proveedorId: string; busqueda: string },
): ProductoConsultaCatalogo[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const q = busqueda.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  return db.select({
    id: schema.producto.id, sku: schema.producto.sku, gtin_barcode: schema.producto.gtin_barcode,
    nombre_corto: schema.producto.nombre_corto, codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
  })
    .from(schema.producto)
    .leftJoin(schema.producto_proveedor, and(
      eq(schema.producto_proveedor.producto_id, schema.producto.id),
      eq(schema.producto_proveedor.proveedor_id, proveedorId),
      isNull(schema.producto_proveedor.deleted_at),
    ))
    .where(and(eq(schema.producto.activo, true), or(
      sql`${schema.producto.nombre_corto} LIKE ${like}`,
      sql`${schema.producto.sku} LIKE ${like}`,
      sql`${schema.producto.gtin_barcode} LIKE ${like}`,
    )))
    .limit(20).all();
}

export function registerImportacionCatalogoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('import.masiva');
  ipcMain.handle('importacionCatalogo:parseArchivo',        guard(async (_e, p) => importacionCatalogoParseArchivoHandler(db, p)));
  ipcMain.handle('importacionCatalogo:revalidarFila',       guard(async (_e, p) => importacionCatalogoRevalidarFilaHandler(db, p)));
  ipcMain.handle('importacionCatalogo:confirmar',           guard(async (_e, p) => importacionCatalogoConfirmarHandler(db, p)));
  ipcMain.handle('importacionCatalogo:getHistorial',        guard(async () => importacionCatalogoGetHistorialHandler(db)));
  ipcMain.handle('importacionCatalogo:getHistorialDetalle', guard(async (_e, id) => importacionCatalogoGetHistorialDetalleHandler(db, id)));
  ipcMain.handle('importacionCatalogo:buscarProductos',     guard(async (_e, p) => importacionCatalogoBuscarProductosHandler(db, p)));
}
