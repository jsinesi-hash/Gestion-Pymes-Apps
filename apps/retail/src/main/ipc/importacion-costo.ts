import * as fs from 'node:fs';
import ExcelJS from 'exceljs';
import { eq, and, or, desc, inArray, ne, sql } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { requirePermission } from '../auth/guard';
import { parseCsvContent, mapearFila, HEADERS_FIJOS } from './importacion-costo.parser';
import { crearBatchesPorEventoDeCosto } from '../precios/motor';
import { crearMatcher, type CandidatoSimilitud } from '../matching/producto-matcher';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-063 Lote 4 — margen mínimo entre el 1º y 2º candidato para pre-seleccionar por umbral.
const MARGEN_MIN = 0.15;

// ── Tipos públicos ─────────────────────────────────────────────────────────────

// Followup ADR-051: nada de esto se persiste hasta Confirmar (ver más abajo) — la fila
// vive solo en memoria del renderer mientras se previsualiza/edita. `fila_num` es la
// identidad de la fila en esta etapa (no hay id de base todavía).
export type FilaPreview = {
  fila_num: number;
  codigo_proveedor_archivo: string | null;
  gtin_archivo: string | null;
  codigo_interno_archivo: string | null;
  producto_id: string | null;
  nombre_producto: string | null;
  costo_anterior_centavos: number | null;
  costo_nuevo_centavos: number | null;
  estado: 'matched' | 'sin_matchear' | 'error_formato';
  // 'similitud' lo asigna el frontend cuando el operador acepta un candidato sugerido en la
  // previsualización (no lo produce el matching por identificador del backend).
  matched_by: 'codigo_proveedor' | 'gtin' | 'codigo_interno' | 'similitud' | null;
  motivo: string | null;
  // Advertencia NO bloqueante (la fila sigue 'matched'). Followup ADR-051: validación
  // cruzada — cuando la fila matchea por EAN pero el código del producto del proveedor
  // del archivo no coincide con el guardado, es señal de que puede ser la lista de otro
  // proveedor. La duplicidad de filas se detecta aparte, en el frontend.
  advertencia: string | null;
  // Sugerencias inline para filas sin_matchear (paridad con Importar Catálogo): nombre del
  // producto tal como lo trae el archivo (DESCRIPCION) + candidatos por similitud ordenados
  // por score. Vacíos cuando la fila ya matcheó o el archivo no trae descripción.
  nombre_producto_archivo: string | null;
  candidatos: CandidatoSimilitud[];
  datos: Record<string, string>;
};

export type PreviewImportacion = {
  filas: FilaPreview[];
  total_matcheadas: number;
  total_sin_match: number;
};

// ── Lookups de matching (compartidos entre parseArchivo y revalidarFila) ───────

type Lookups = {
  porCodigo: Map<string, { productoId: string; costoActual: number | null }>;
  porGtin: Map<string, { productoId: string; costoActual: number | null }>;
  porSku: Map<string, { productoId: string; costoActual: number | null }>;
  nombresPorId: Map<string, string>;
  // Código del producto del proveedor guardado para (este proveedor, productoId) — para
  // la validación cruzada (advertencia). Null si el vínculo no tiene código cargado.
  codigoGuardadoPorProducto: Map<string, string | null>;
};

// Matcheo contra TODO el catálogo (revierte el scope estricto de ADR-051 — decisión de
// producto 2026-09-17). EAN e COD_INTERNO (nuestro SKU) son identificadores del PRODUCTO,
// no del vínculo, así que identifican el producto aunque todavía no esté asociado a este
// proveedor; el vínculo (producto_proveedor) se crea recién al Confirmar. COD_PRODUCTO_PROV
// sigue resolviéndose sólo contra vínculos existentes: es un dato del vínculo, no del
// producto. La validación cruzada por código (advertencia) sigue cubriendo el caso de una
// lista cargada al proveedor equivocado.
function construirLookups(db: Db, proveedorId: string): Lookups {
  // Costos y códigos guardados para ESTE proveedor (vínculo producto_proveedor).
  const pps = db.select({
    producto_id:      schema.producto_proveedor.producto_id,
    codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
    costo_centavos:   schema.producto_proveedor.costo_centavos,
  })
    .from(schema.producto_proveedor)
    .where(eq(schema.producto_proveedor.proveedor_id, proveedorId))
    .all();

  const porCodigo = new Map<string, { productoId: string; costoActual: number | null }>();
  const codigoGuardadoPorProducto = new Map<string, string | null>();
  const costoVinculadoPorProducto = new Map<string, number>();
  for (const pp of pps) {
    costoVinculadoPorProducto.set(pp.producto_id, pp.costo_centavos);
    codigoGuardadoPorProducto.set(pp.producto_id, pp.codigo_proveedor ?? null);
    if (pp.codigo_proveedor) {
      porCodigo.set(pp.codigo_proveedor.trim(), { productoId: pp.producto_id, costoActual: pp.costo_centavos });
    }
  }

  // EAN e COD_INTERNO se resuelven contra todo el catálogo activo. `costoActual` es el
  // costo previo para ESTE proveedor si el producto ya estaba vinculado, o null si no
  // (no hay "costo anterior" que mostrar todavía).
  const porGtin = new Map<string, { productoId: string; costoActual: number | null }>();
  const porSku = new Map<string, { productoId: string; costoActual: number | null }>();
  const nombresPorId = new Map<string, string>();

  const prods = db.select({
    id:           schema.producto.id,
    sku:          schema.producto.sku,
    gtin_barcode: schema.producto.gtin_barcode,
    nombre_corto: schema.producto.nombre_corto,
  })
    .from(schema.producto)
    .where(eq(schema.producto.activo, true))
    .all();

  for (const prod of prods) {
    nombresPorId.set(prod.id, prod.nombre_corto);
    const costo = costoVinculadoPorProducto.get(prod.id) ?? null;
    if (prod.gtin_barcode) {
      porGtin.set(prod.gtin_barcode.trim(), { productoId: prod.id, costoActual: costo });
    }
    if (prod.sku) {
      porSku.set(prod.sku.trim().toUpperCase(), { productoId: prod.id, costoActual: costo });
    }
  }

  return { porCodigo, porGtin, porSku, nombresPorId, codigoGuardadoPorProducto };
}

// Cascada de identificación: EAN → código del producto del proveedor → código interno
// (SKU). El primero que matchee un producto (de este proveedor) gana. Además, valida
// cruzado: si matchea pero el código del producto del proveedor del archivo difiere del
// guardado, emite una advertencia (no bloquea).
function matchearFila(
  mapped: { gtin_archivo: string | null; codigo_proveedor_archivo: string | null; codigo_interno_archivo: string | null; costo_centavos: number | null },
  lookups: Lookups,
): Pick<FilaPreview, 'producto_id' | 'nombre_producto' | 'costo_anterior_centavos' | 'costo_nuevo_centavos' | 'estado' | 'matched_by' | 'motivo' | 'advertencia'> {
  let matched_by: FilaPreview['matched_by'] = null;
  let productoIdMatch: string | null = null;
  let costoAnterior: number | null = null;

  if (mapped.gtin_archivo) {
    const hit = lookups.porGtin.get(mapped.gtin_archivo);
    if (hit) { matched_by = 'gtin'; productoIdMatch = hit.productoId; costoAnterior = hit.costoActual; }
  }
  if (!productoIdMatch && mapped.codigo_proveedor_archivo) {
    const hit = lookups.porCodigo.get(mapped.codigo_proveedor_archivo);
    if (hit) { matched_by = 'codigo_proveedor'; productoIdMatch = hit.productoId; costoAnterior = hit.costoActual; }
  }
  if (!productoIdMatch && mapped.codigo_interno_archivo) {
    const hit = lookups.porSku.get(mapped.codigo_interno_archivo.toUpperCase());
    if (hit) { matched_by = 'codigo_interno'; productoIdMatch = hit.productoId; costoAnterior = hit.costoActual; }
  }

  let estado: FilaPreview['estado'];
  let motivo: string | null = null;
  if (mapped.costo_centavos === null) {
    estado = 'error_formato';
    motivo = 'Costo no es un número válido';
  } else if (productoIdMatch) {
    estado = 'matched';
  } else {
    estado = 'sin_matchear';
    motivo = 'Sin identificar — revisar en Cola de Revisión';
  }

  // Validación cruzada por código del producto del proveedor. Cuando matchea por código
  // los valores son iguales por construcción (así se encontró), así que esto solo dispara
  // en matches por EAN/SKU con un código de archivo distinto al guardado.
  let advertencia: string | null = null;
  if (productoIdMatch && mapped.codigo_proveedor_archivo) {
    const guardado = lookups.codigoGuardadoPorProducto.get(productoIdMatch);
    if (guardado && guardado.trim() !== mapped.codigo_proveedor_archivo.trim()) {
      advertencia = 'El código del producto no coincide con el guardado para este proveedor — ¿es la lista correcta?';
    }
  }

  return {
    producto_id: productoIdMatch,
    nombre_producto: productoIdMatch ? (lookups.nombresPorId.get(productoIdMatch) ?? null) : null,
    costo_anterior_centavos: costoAnterior,
    costo_nuevo_centavos: mapped.costo_centavos,
    estado,
    matched_by,
    motivo,
    advertencia,
  };
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// Followup ADR-051: parseArchivo es puramente de lectura — NO escribe nada en la base.
// El preview (incluidas las ediciones inline) vive en memoria del renderer hasta que el
// usuario hace clic en Confirmar; recién ahí se persiste todo de una vez (ver
// importacionCostoConfirmarHandler). Esto permite que Previsualizar sea "persistente"
// (sobrevive navegar a otra pantalla y volver, vía Context en el renderer) sin que
// aparezca nada en el Histórico ni en la Cola de Revisión antes de tiempo, y que
// "Cancelar" sea instantáneo (no hay nada que deshacer en la base).
export async function importacionCostoParseArchivoHandler(
  db: Db,
  { filePath, proveedorId }: { filePath: string; proveedorId: string },
): Promise<PreviewImportacion> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ── 1. Parsear el archivo — formato fijo, sin mapeo configurable (followup ADR-051) ──
  let headers: Map<string, number>;
  let rows: string[][];

  if (filePath.toLowerCase().endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const ws = workbook.worksheets[0];
    if (!ws) throw new Error('XLSX_EMPTY');

    const allRows: string[][] = [];
    ws.eachRow((row) => {
      allRows.push(
        (row.values as (ExcelJS.CellValue | null)[]).slice(1).map(v =>
          v === null || v === undefined ? '' : String(v)
        )
      );
    });

    const headerRow = allRows[0] ?? [];
    headers = new Map<string, number>();
    headerRow.forEach((h, i) => { if (h) headers.set(h.trim().toUpperCase(), i); });
    rows = allRows.slice(1).filter(r => r.some(c => c.trim()));
  } else {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseCsvContent(content);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  // ── 2. Match + construir filas ───────────────────────────────────────────────
  const lookups = construirLookups(db, proveedorId);
  // Matcher por similitud armado una sola vez (índice invertido sobre el catálogo). Para las
  // filas sin match por identificador se ofrecen candidatos por la DESCRIPCION del archivo.
  const matcher = crearMatcher(db);
  const filasResultado: FilaPreview[] = [];
  let filasConCostoInvalido = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = mapearFila(row, headers);
    const match = matchearFila(mapped, lookups);
    if (match.estado === 'error_formato') filasConCostoInvalido++;

    const rawRow: Record<string, string> = {};
    for (const [header, idx] of headers.entries()) {
      rawRow[header] = row[idx] ?? '';
    }

    const candidatos = (match.estado === 'sin_matchear' && mapped.nombre_archivo)
      ? matcher.sugerir(mapped.nombre_archivo)
      : [];

    filasResultado.push({
      fila_num: i + 1,
      codigo_proveedor_archivo: mapped.codigo_proveedor_archivo,
      gtin_archivo: mapped.gtin_archivo,
      codigo_interno_archivo: mapped.codigo_interno_archivo,
      nombre_producto_archivo: mapped.nombre_archivo,
      candidatos,
      datos: rawRow,
      ...match,
    });
  }

  // ── 3b. Hard-stop (A.4): si el 100% de las filas quedó sin costo parseable, la
  // columna COSTO probablemente no existe en el archivo con ese nombre exacto (o el
  // archivo no respeta el formato fijo esperado). Cortar antes de persistir evita
  // crear una importación de puros error_formato sin explicación. Requiere más de
  // una fila: con una sola fila mala no hay forma de distinguir "falta la columna" de
  // "este dato puntual está mal cargado".
  if (rows.length > 1 && filasConCostoInvalido === rows.length) {
    throw new Error(
      `No se pudo leer ningún costo válido — revisá que el archivo tenga una columna llamada '${HEADERS_FIJOS.costo}' con el formato esperado.`
    );
  }

  const totalMatcheadas = filasResultado.filter(f => f.estado === 'matched').length;
  const totalSinMatch   = filasResultado.filter(f => f.estado === 'sin_matchear').length;

  return {
    filas: filasResultado,
    total_matcheadas: totalMatcheadas,
    total_sin_match:  totalSinMatch,
  };
}

export type RevalidarFilaPayload = { proveedorId: string; datos: Record<string, string> };
export type RevalidarFilaResultado = Pick<FilaPreview,
  'producto_id' | 'nombre_producto' | 'costo_anterior_centavos' | 'costo_nuevo_centavos' | 'estado' | 'matched_by' | 'motivo' | 'advertencia'
> & {
  codigo_proveedor_archivo: string | null;
  gtin_archivo: string | null;
  codigo_interno_archivo: string | null;
  nombre_producto_archivo: string | null;
  candidatos: CandidatoSimilitud[];
};

// Followup ADR-051 (fix de la validación): al editar EAN / código de proveedor / código
// interno / costo de una fila en Previsualizar, hay que RE-CORRER el matching real contra
// la base — no alcanza con re-validar el formato del costo. Como el matching necesita los
// lookups de la base, esto vive en el backend (el frontend no puede resolverlo solo). Es
// puramente de lectura: no persiste nada (igual que parseArchivo).
export function importacionCostoRevalidarFilaHandler(
  db: Db,
  { proveedorId, datos }: RevalidarFilaPayload,
): RevalidarFilaResultado {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // `datos` viene keyeado por nombre de header real; reconstruimos headers Map + row
  // para reusar mapearFila con el mismo criterio de columnas fijas.
  const columnas = Object.keys(datos);
  const headers = new Map<string, number>();
  columnas.forEach((h, i) => headers.set(h.toUpperCase(), i));
  const row = columnas.map(h => datos[h]);

  const mapped = mapearFila(row, headers);
  const lookups = construirLookups(db, proveedorId);
  const match = matchearFila(mapped, lookups);

  // Si sigue sin identificar, recomputar candidatos por similitud de la DESCRIPCION editada.
  const candidatos = (match.estado === 'sin_matchear' && mapped.nombre_archivo)
    ? crearMatcher(db).sugerir(mapped.nombre_archivo)
    : [];

  return {
    codigo_proveedor_archivo: mapped.codigo_proveedor_archivo,
    gtin_archivo: mapped.gtin_archivo,
    codigo_interno_archivo: mapped.codigo_interno_archivo,
    nombre_producto_archivo: mapped.nombre_archivo,
    candidatos,
    ...match,
  };
}

export type ProductoConsultaItem = {
  id: string;
  sku: string;
  gtin_barcode: string | null;
  nombre_corto: string;
  codigo_proveedor: string | null;
};

// Followup ADR-051: búsqueda de productos para el modal "Consultar productos" de Importar
// Costos. A diferencia de catalogo.producto.list, incluye el código del producto PARA ESE
// proveedor (producto_proveedor.codigo_proveedor), que es justo lo que el usuario quiere
// chequear al cargar costos. Busca por nombre, SKU o EAN.
export function importacionCostoBuscarProductosHandler(
  db: Db,
  { proveedorId, busqueda }: { proveedorId: string; busqueda: string },
): ProductoConsultaItem[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const q = busqueda.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  return db.select({
    id:               schema.producto.id,
    sku:              schema.producto.sku,
    gtin_barcode:     schema.producto.gtin_barcode,
    nombre_corto:     schema.producto.nombre_corto,
    codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
  })
    .from(schema.producto)
    .leftJoin(
      schema.producto_proveedor,
      and(
        eq(schema.producto_proveedor.producto_id, schema.producto.id),
        eq(schema.producto_proveedor.proveedor_id, proveedorId),
      ),
    )
    .where(and(
      eq(schema.producto.activo, true),
      or(
        sql`${schema.producto.nombre_corto} LIKE ${like}`,
        sql`${schema.producto.sku} LIKE ${like}`,
        sql`${schema.producto.gtin_barcode} LIKE ${like}`,
      ),
    ))
    .limit(20)
    .all();
}

export type ConfirmarPayload = {
  proveedorId: string;
  nombreArchivo: string;
  filas: FilaPreview[];
};

// Followup ADR-051: acá se persiste TODO de una sola vez — la cabecera de la
// importación (directo en estado 'confirmado', nunca pasa por 'pendiente'), el detalle
// de cada fila (matched/error_formato/sin_matchear, igual que antes se hacía al
// parsear) y la actualización real de costo en producto_proveedor para las filas
// matcheadas. Antes de este punto no existe ningún rastro en la base — cancelar antes
// de llegar acá no deja nada que limpiar.
export async function importacionCostoConfirmarHandler(
  db: Db,
  { proveedorId, nombreArchivo, filas }: ConfirmarPayload,
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (filas.length === 0) throw new Error('SIN_FILAS_PARA_CONFIRMAR');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const importacionId = generateId();
  const totalMatcheadas = filas.filter(f => f.estado === 'matched').length;
  const totalSinMatch   = filas.filter(f => f.estado === 'sin_matchear').length;
  const productoIdsActualizados: string[] = [];

  db.transaction(() => {
    db.insert(schema.importacion_costo_proveedor).values({
      id:                importacionId,
      proveedor_id:      proveedorId,
      nombre_archivo:    nombreArchivo,
      fecha_importacion: now,
      filas_totales:     filas.length,
      filas_matcheadas:  totalMatcheadas,
      filas_sin_match:   totalSinMatch,
      estado:            'confirmado',
      usuario_id:        session.userId,
      ...sync,
    }).run();

    for (const fila of filas) {
      db.insert(schema.importacion_costo_proveedor_detalle).values({
        id:                      generateId(),
        importacion_id:          importacionId,
        producto_id:             fila.producto_id,
        costo_anterior_centavos: fila.costo_anterior_centavos,
        costo_nuevo_centavos:    fila.costo_nuevo_centavos,
        fila_original:           JSON.stringify({ fila_num: fila.fila_num, datos: fila.datos }),
        estado:                  fila.estado,
        matched_by:              fila.matched_by,
        resuelto_por_usuario_id: null,
        fecha_resolucion:        null,
        ...sync,
      }).run();

      if (fila.estado !== 'matched' || !fila.producto_id || fila.costo_nuevo_centavos === null) continue;

      const existing = db.select({ id: schema.producto_proveedor.id })
        .from(schema.producto_proveedor)
        .where(and(
          eq(schema.producto_proveedor.producto_id, fila.producto_id),
          eq(schema.producto_proveedor.proveedor_id, proveedorId),
        ))
        .get();

      if (existing) {
        db.update(schema.producto_proveedor)
          .set({ costo_centavos: fila.costo_nuevo_centavos, ...sync })
          .where(eq(schema.producto_proveedor.id, existing.id))
          .run();
      } else {
        db.insert(schema.producto_proveedor).values({
          id:                  generateId(),
          producto_id:         fila.producto_id,
          proveedor_id:        proveedorId,
          costo_centavos:      fila.costo_nuevo_centavos,
          codigo_proveedor:    null,
          preferido:           false,
          usuario_creacion_id: session.userId,
          fecha_creacion:      now,
          ...sync,
        }).run();
      }
      productoIdsActualizados.push(fila.producto_id);
    }
  });

  // ADR-049 §7 — cierre del circuito de costo: dispara un batch en borrador por cada
  // lista en modo margen_costo, acotado a los productos de esta importación.
  let batches: { id: string; lista_precio_id: string; estado: string }[] = [];
  try {
    batches = crearBatchesPorEventoDeCosto(db, {
      producto_ids: productoIdsActualizados,
      origen: 'PROVIDER_COST_UPDATE',
      proveedor_id: proveedorId,
      referencia_tipo: 'importacion_costo_proveedor',
      referencia_id: importacionId,
    }, session.userId);
  } catch (e) {
    console.error('[precios] Error generando batch por importación de costos:', e);
  }

  return { ok: true, importacion_id: importacionId, filas_actualizadas: totalMatcheadas, batches };
}

// ADR-051 A.6: cierra el hueco del estado `cancelado` — hasta acá, "Cancelar" en el
// preview solo limpiaba estado local de React y la importación quedaba `pendiente`
// para siempre, indistinguible de una que el usuario abandonó a mitad.
export function importacionCostoCancelarHandler(
  db: Db,
  { importacionId }: { importacionId: string },
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const importacion = db.select()
    .from(schema.importacion_costo_proveedor)
    .where(eq(schema.importacion_costo_proveedor.id, importacionId))
    .get();
  if (!importacion) throw new Error('IMPORTACION_NOT_FOUND');
  if (importacion.estado !== 'pendiente') throw new Error('IMPORTACION_YA_PROCESADA');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.update(schema.importacion_costo_proveedor)
    .set({ estado: 'cancelado', ...sync })
    .where(eq(schema.importacion_costo_proveedor.id, importacionId))
    .run();

  return { ok: true };
}

// Followup ADR-051: una importación 'cancelado' (o 'pendiente' huérfana) no aporta nada
// quedándose para siempre en el Histórico — a diferencia de 'confirmado' (que sí cambió
// costos reales y es auditoría), acá no hay ningún dato real que preservar. Borrado
// físico real (no baja lógica): es la única excepción a la baja lógica del resto de la
// app porque esto nunca fue un registro de negocio, fue un intento de carga que no llegó
// a nada.
export function importacionCostoEliminarHandler(
  db: Db,
  { importacionId }: { importacionId: string },
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const importacion = db.select()
    .from(schema.importacion_costo_proveedor)
    .where(eq(schema.importacion_costo_proveedor.id, importacionId))
    .get();
  if (!importacion) throw new Error('IMPORTACION_NOT_FOUND');
  if (importacion.estado === 'confirmado') throw new Error('IMPORTACION_CONFIRMADA_NO_SE_PUEDE_ELIMINAR');

  db.transaction(() => {
    db.delete(schema.importacion_costo_proveedor_detalle)
      .where(eq(schema.importacion_costo_proveedor_detalle.importacion_id, importacionId))
      .run();
    db.delete(schema.importacion_costo_proveedor)
      .where(eq(schema.importacion_costo_proveedor.id, importacionId))
      .run();
  });

  return { ok: true };
}

export type HistorialItem = {
  id: string;
  proveedor: string;
  nombre_archivo: string;
  fecha_importacion: number;
  filas_totales: number;
  // Desglose EN VIVO (se recalcula desde el detalle en cada consulta, así siempre
  // reconcilia con el total y refleja resoluciones posteriores):
  identificados: number; // matched + resuelto_manual (costo aplicado)
  rechazados: number;    // error_formato (costo inválido, no aplicado)
  pendientes: number;    // sin_matchear (todavía requiere resolución en Cola de Revisión)
  descartados: number;   // descartado en Cola de Revisión
  estado: 'pendiente' | 'confirmado' | 'cancelado';
};

// Followup ADR-051: el desglose se calcula EN VIVO desde el detalle — nada congelado.
// identificados + rechazados + pendientes + descartados = filas_totales, siempre.
export function importacionCostoGetHistorialHandler(db: Db): HistorialItem[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const importaciones = db.select({
    id:                schema.importacion_costo_proveedor.id,
    proveedor:         schema.proveedor.razon_social,
    nombre_archivo:    schema.importacion_costo_proveedor.nombre_archivo,
    fecha_importacion: schema.importacion_costo_proveedor.fecha_importacion,
    filas_totales:     schema.importacion_costo_proveedor.filas_totales,
    estado:            schema.importacion_costo_proveedor.estado,
  })
    .from(schema.importacion_costo_proveedor)
    .innerJoin(schema.proveedor, eq(schema.importacion_costo_proveedor.proveedor_id, schema.proveedor.id))
    .orderBy(desc(schema.importacion_costo_proveedor.fecha_importacion))
    .all();

  // Un solo query: conteo por (importacion_id, estado) del detalle.
  const conteos = db.select({
    importacion_id: schema.importacion_costo_proveedor_detalle.importacion_id,
    estado:         schema.importacion_costo_proveedor_detalle.estado,
    n:              sql<number>`count(*)`,
  })
    .from(schema.importacion_costo_proveedor_detalle)
    .groupBy(
      schema.importacion_costo_proveedor_detalle.importacion_id,
      schema.importacion_costo_proveedor_detalle.estado,
    )
    .all();

  const porImportacion = new Map<string, Record<string, number>>();
  for (const c of conteos) {
    const m = porImportacion.get(c.importacion_id) ?? {};
    m[c.estado] = Number(c.n);
    porImportacion.set(c.importacion_id, m);
  }

  return importaciones.map(imp => {
    const m = porImportacion.get(imp.id) ?? {};
    // Una importación cancelada no tiene nada "pendiente": sus filas sin_matchear ya
    // quedaron fuera de la Cola de Revisión — no se cuentan como pendientes.
    const pendientes = imp.estado === 'cancelado' ? 0 : (m['sin_matchear'] ?? 0);
    return {
      id: imp.id,
      proveedor: imp.proveedor,
      nombre_archivo: imp.nombre_archivo,
      fecha_importacion: imp.fecha_importacion.getTime(),
      filas_totales: imp.filas_totales,
      identificados: (m['matched'] ?? 0) + (m['resuelto_manual'] ?? 0),
      rechazados: m['error_formato'] ?? 0,
      pendientes,
      descartados: m['descartado'] ?? 0,
      estado: imp.estado,
    };
  });
}

export type HistorialDetalleFila = {
  detalle_id: string;
  fila_num: number;
  datos: Record<string, string>;
  nombre_producto: string | null;
  costo_anterior_centavos: number | null;
  costo_nuevo_centavos: number | null;
  estado: 'matched' | 'sin_matchear' | 'error_formato' | 'resuelto_manual' | 'descartado';
  motivo: string | null;
};

export function importacionCostoGetHistorialDetalleHandler(db: Db, importacionId: string): HistorialDetalleFila[] {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const detalles = db.select({
    id:                      schema.importacion_costo_proveedor_detalle.id,
    producto_id:             schema.importacion_costo_proveedor_detalle.producto_id,
    costo_anterior_centavos: schema.importacion_costo_proveedor_detalle.costo_anterior_centavos,
    costo_nuevo_centavos:    schema.importacion_costo_proveedor_detalle.costo_nuevo_centavos,
    fila_original:           schema.importacion_costo_proveedor_detalle.fila_original,
    estado:                  schema.importacion_costo_proveedor_detalle.estado,
  })
    .from(schema.importacion_costo_proveedor_detalle)
    .where(eq(schema.importacion_costo_proveedor_detalle.importacion_id, importacionId))
    .all();

  const prodIds = [...new Set(detalles.map(d => d.producto_id).filter((id): id is string => !!id))];
  const nombresPorId = new Map<string, string>();
  if (prodIds.length > 0) {
    db.select({ id: schema.producto.id, nombre: schema.producto.nombre_corto })
      .from(schema.producto)
      .where(inArray(schema.producto.id, prodIds))
      .all()
      .forEach(p => nombresPorId.set(p.id, p.nombre));
  }

  return detalles.map(d => {
    let filaNum = 0;
    let datos: Record<string, string> = {};
    try {
      const parsed = JSON.parse(d.fila_original ?? '{}');
      filaNum = parsed.fila_num ?? 0;
      datos = parsed.datos ?? {};
    } catch { /* fila_original ausente o corrupto: se muestran fila_num=0 y datos vacíos, no bloquea el listado */ }

    const motivo =
      d.estado === 'error_formato' ? 'Costo no es un número válido'
      : d.estado === 'sin_matchear' ? 'Sin identificar — revisar en Cola de Revisión'
      : null;

    return {
      detalle_id: d.id,
      fila_num: filaNum,
      datos,
      nombre_producto: d.producto_id ? (nombresPorId.get(d.producto_id) ?? null) : null,
      costo_anterior_centavos: d.costo_anterior_centavos,
      costo_nuevo_centavos: d.costo_nuevo_centavos,
      estado: d.estado,
      motivo,
    };
  });
}

export type ColaRevisionFila = {
  detalle_id: string;
  importacion_id: string;
  estado: string;
  costo_nuevo_centavos: number | null;
  fila_original: string | null;
  nombre_archivo: string;        // nombre del ARCHIVO importado (no del producto)
  fecha_importacion: Date;
  proveedor_id: string;
  razon_social: string;
  // ADR-063 Lote 4: sugerencias por similitud de nombre.
  nombre_producto_archivo: string | null;       // nombre del PRODUCTO tal como lo trae el proveedor
  candidatos: CandidatoSimilitud[];             // top-N ordenados por score desc
  preseleccion: { producto_id: string; score: number } | null; // pre-marca por umbral (opt-in)
};

export async function importacionCostoGetColaRevisionHandler(db: Db): Promise<ColaRevisionFila[]> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const filas = db.select({
    detalle_id:              schema.importacion_costo_proveedor_detalle.id,
    importacion_id:          schema.importacion_costo_proveedor_detalle.importacion_id,
    estado:                  schema.importacion_costo_proveedor_detalle.estado,
    costo_nuevo_centavos:    schema.importacion_costo_proveedor_detalle.costo_nuevo_centavos,
    fila_original:           schema.importacion_costo_proveedor_detalle.fila_original,
    nombre_archivo:          schema.importacion_costo_proveedor.nombre_archivo,
    fecha_importacion:       schema.importacion_costo_proveedor.fecha_importacion,
    proveedor_id:            schema.importacion_costo_proveedor.proveedor_id,
    razon_social:            schema.proveedor.razon_social,
  })
    .from(schema.importacion_costo_proveedor_detalle)
    .innerJoin(
      schema.importacion_costo_proveedor,
      eq(schema.importacion_costo_proveedor_detalle.importacion_id, schema.importacion_costo_proveedor.id),
    )
    .innerJoin(
      schema.proveedor,
      eq(schema.importacion_costo_proveedor.proveedor_id, schema.proveedor.id),
    )
    // una importación cancelada no debe dejar sus filas sin_matchear como "pendientes"
    // eternas en la cola — se canceló la carga entera, no solo algunas filas.
    .where(and(
      eq(schema.importacion_costo_proveedor_detalle.estado, 'sin_matchear'),
      ne(schema.importacion_costo_proveedor.estado, 'cancelado'),
    ))
    .all();

  if (filas.length === 0) return [];

  // ADR-063 Lote 4: matcher armado una sola vez (índice invertido sobre todo el catálogo)
  // + umbrales por proveedor. Para cada fila con nombre en el archivo se calculan candidatos.
  const matcher = crearMatcher(db);
  const umbrales = new Map<string, number | null>();
  for (const p of db.select({ id: schema.proveedor.id, umbral: schema.proveedor.match_umbral_preseleccion }).from(schema.proveedor).all()) {
    umbrales.set(p.id, p.umbral ?? null);
  }

  return filas.map((f): ColaRevisionFila => {
    const nombreProducto = nombreDeFilaOriginal(f.fila_original);
    const candidatos = nombreProducto ? matcher.sugerir(nombreProducto) : [];

    // Pre-selección opt-in: sólo si el proveedor tiene umbral y el top supera el umbral con
    // margen suficiente sobre el segundo. Nunca escribe: sólo marca el estado inicial.
    let preseleccion: { producto_id: string; score: number } | null = null;
    const umbral = umbrales.get(f.proveedor_id) ?? null;
    if (umbral !== null && candidatos.length > 0) {
      const top = candidatos[0];
      const segundo = candidatos[1]?.score ?? 0;
      if (top.score * 100 >= umbral && (top.score - segundo) >= MARGEN_MIN) {
        preseleccion = { producto_id: top.producto_id, score: top.score };
      }
    }

    return { ...f, nombre_producto_archivo: nombreProducto, candidatos, preseleccion };
  });
}

// ADR-063 §1: recupera el COD_PRODUCTO_PROV crudo de una fila persistida
// (fila_original = JSON de { fila_num, datos }, con `datos` keyeado por header). Reconstruye
// headers + row para reusar mapearFila con el mismo criterio de columnas fijas que el parseo.
// Devuelve null si la fila no trae código o el JSON está ausente/corrupto (no bloquea).
function codigoProveedorDeFilaOriginal(filaOriginal: string | null): string | null {
  try {
    const datos = (JSON.parse(filaOriginal ?? '{}').datos ?? {}) as Record<string, string>;
    const columnas = Object.keys(datos);
    if (columnas.length === 0) return null;
    const headers = new Map<string, number>();
    columnas.forEach((h, i) => headers.set(h.toUpperCase(), i));
    const row = columnas.map(h => datos[h]);
    return mapearFila(row, headers).codigo_proveedor_archivo;
  } catch {
    return null;
  }
}

// ADR-063 Lote 4: extrae el NOMBRE del producto del proveedor de la fila cruda (si el
// archivo trae esa columna). Es el texto que alimenta el matcher de similitud.
function nombreDeFilaOriginal(filaOriginal: string | null): string | null {
  try {
    const datos = (JSON.parse(filaOriginal ?? '{}').datos ?? {}) as Record<string, string>;
    const columnas = Object.keys(datos);
    if (columnas.length === 0) return null;
    const headers = new Map<string, number>();
    columnas.forEach((h, i) => headers.set(h.toUpperCase(), i));
    const row = columnas.map(h => datos[h]);
    return mapearFila(row, headers).nombre_archivo;
  } catch {
    return null;
  }
}

export async function importacionCostoResolverFilaHandler(
  db: Db,
  { detalleId, productoId, proveedorId, origen = 'manual' }:
    { detalleId: string; productoId: string; proveedorId: string; origen?: 'manual' | 'similitud' },
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const detalle = db.select()
    .from(schema.importacion_costo_proveedor_detalle)
    .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId))
    .get();
  if (!detalle) throw new Error('DETALLE_NOT_FOUND');
  if (detalle.estado !== 'sin_matchear') throw new Error('DETALLE_YA_RESUELTO');

  // ADR-063 §1: el match manual se aprende. Recuperamos el código que el proveedor usó
  // para este producto (COD_PRODUCTO_PROV de la fila del archivo) y lo persistimos en
  // producto_proveedor.codigo_proveedor, para que la próxima importación auto-matchee y
  // la fila no reaparezca en la cola. Mismo patrón de reconstrucción que revalidarFila.
  const codigoProveedorArchivo = codigoProveedorDeFilaOriginal(detalle.fila_original);

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.transaction(() => {
    const existing = db.select({ id: schema.producto_proveedor.id })
      .from(schema.producto_proveedor)
      .where(and(
        eq(schema.producto_proveedor.producto_id, productoId),
        eq(schema.producto_proveedor.proveedor_id, proveedorId),
      ))
      .get();

    if (existing) {
      // Sólo pisamos el código si la fila trae uno; si no, preservamos el existente.
      db.update(schema.producto_proveedor)
        .set({
          costo_centavos: detalle.costo_nuevo_centavos ?? 0,
          ...(codigoProveedorArchivo ? { codigo_proveedor: codigoProveedorArchivo } : {}),
          ...sync,
        })
        .where(eq(schema.producto_proveedor.id, existing.id))
        .run();
    } else {
      db.insert(schema.producto_proveedor).values({
        id:                  generateId(),
        producto_id:         productoId,
        proveedor_id:        proveedorId,
        costo_centavos:      detalle.costo_nuevo_centavos ?? 0,
        codigo_proveedor:    codigoProveedorArchivo,
        preferido:           false,
        usuario_creacion_id: session.userId,
        fecha_creacion:      now,
        ...sync,
      }).run();
    }

    db.update(schema.importacion_costo_proveedor_detalle).set({
      producto_id:             productoId,
      estado:                  'resuelto_manual',
      // ADR-063 Lote 4: 'similitud' si el operador aceptó una sugerencia; 'manual' si la buscó.
      matched_by:              origen,
      resuelto_por_usuario_id: session.userId,
      fecha_resolucion:        now,
      ...sync,
    }).where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId)).run();
  });

  return { ok: true };
}

export type ActualizarFilaPayload = {
  detalleId: string;
  costoNuevoCentavos: number;
  datos: Record<string, string>;
};

export function importacionCostoDescartarFilaHandler(db: Db, detalleId: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const detalle = db.select()
    .from(schema.importacion_costo_proveedor_detalle)
    .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId))
    .get();
  if (!detalle) throw new Error('DETALLE_NOT_FOUND');
  if (detalle.estado !== 'sin_matchear') throw new Error('DETALLE_NO_ES_SIN_MATCHEAR');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.update(schema.importacion_costo_proveedor_detalle)
    .set({ estado: 'descartado', ...sync })
    .where(eq(schema.importacion_costo_proveedor_detalle.id, detalleId))
    .run();

  return { ok: true };
}

export function importacionCostoActualizarFilaHandler(db: Db, payload: ActualizarFilaPayload) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const detalle = db.select()
    .from(schema.importacion_costo_proveedor_detalle)
    .where(eq(schema.importacion_costo_proveedor_detalle.id, payload.detalleId))
    .get();
  if (!detalle) throw new Error('DETALLE_NOT_FOUND');
  if (detalle.estado !== 'sin_matchear') throw new Error('DETALLE_NO_ES_SIN_MATCHEAR');

  let filaNum = 0;
  try {
    filaNum = JSON.parse(detalle.fila_original ?? '{}').fila_num ?? 0;
  } catch {}

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  db.update(schema.importacion_costo_proveedor_detalle)
    .set({
      costo_nuevo_centavos: payload.costoNuevoCentavos,
      fila_original: JSON.stringify({ fila_num: filaNum, datos: payload.datos }),
      ...sync,
    })
    .where(eq(schema.importacion_costo_proveedor_detalle.id, payload.detalleId))
    .run();

  return { ok: true };
}

export function registerImportacionCostoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('import.masiva');
  ipcMain.handle('importacionCosto:parseArchivo',    guard(async (_e, p) => importacionCostoParseArchivoHandler(db, p)));
  ipcMain.handle('importacionCosto:revalidarFila',   guard(async (_e, p) => importacionCostoRevalidarFilaHandler(db, p)));
  ipcMain.handle('importacionCosto:buscarProductos', guard(async (_e, p) => importacionCostoBuscarProductosHandler(db, p)));
  ipcMain.handle('importacionCosto:confirmar',       guard(async (_e, p) => importacionCostoConfirmarHandler(db, p)));
  ipcMain.handle('importacionCosto:getColaRevision', guard(async () => importacionCostoGetColaRevisionHandler(db)));
  ipcMain.handle('importacionCosto:resolverFila',    guard(async (_e, p) => importacionCostoResolverFilaHandler(db, p)));
  ipcMain.handle('importacionCosto:descartarFila',   guard(async (_e, detalleId) => importacionCostoDescartarFilaHandler(db, detalleId)));
  ipcMain.handle('importacionCosto:actualizarFila',  guard(async (_e, p) => importacionCostoActualizarFilaHandler(db, p)));
  ipcMain.handle('importacionCosto:cancelar',        guard(async (_e, p) => importacionCostoCancelarHandler(db, p)));
  ipcMain.handle('importacionCosto:eliminar',        guard(async (_e, p) => importacionCostoEliminarHandler(db, p)));
  ipcMain.handle('importacionCosto:getHistorial',    guard(async () => importacionCostoGetHistorialHandler(db)));
  ipcMain.handle('importacionCosto:getHistorialDetalle', guard(async (_e, importacionId) => importacionCostoGetHistorialDetalleHandler(db, importacionId)));
}
