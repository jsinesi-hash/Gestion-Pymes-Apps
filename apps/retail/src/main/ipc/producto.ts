import { eq, and, or, like, sql, getTableColumns, gt, lte, asc, desc, inArray } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, formatSku } from '@ferreteria/shared';
export { parseSku } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, str, optStr, num, bool, id as vId, optId } from '@core/main';
import { crearPresentacionDefault } from './presentacion';
import { esSinonimosHabilitado, expandirTerminos } from '../sinonimos/buscar';
import { normalizarTermino } from '../sinonimos/normalizar';
import { crearMatcher } from '../matching/producto-matcher';
import { getPrecioEnListaHandler } from './lista-precio-valor';

type Db = BetterSQLite3Database<typeof schema>;

export type CreateProductoPayload = {
  nombre_corto: string;
  nombre_largo?: string;
  descripcion_tecnica?: string;
  categoria_id: string;
  marca_id?: string;
  unidad_venta: string;
  unidad_compra?: string;
  factor_conversion?: number;
  permite_fraccion?: boolean;
  gtin_barcode?: string;
  impuesto_id: string;
  precio_venta_lista: number;
  stock_minimo?: number;
  stock_maximo?: number;
  ubicacion_id?: string;
  stock_inicial?: { cantidad: number; costo?: number };
};

export type UpdateProductoPayload = {
  id: string;
  nombre_corto?: string;
  nombre_largo?: string;
  descripcion_tecnica?: string;
  categoria_id?: string;
  marca_id?: string;
  unidad_venta?: string;
  unidad_compra?: string;
  factor_conversion?: number;
  permite_fraccion?: boolean;
  gtin_barcode?: string;
  impuesto_id?: string;
  precio_venta_lista?: number;
  ubicacion_id?: string;
};

export type ProductoListParams = {
  busqueda?: string;
  categoria_id?: string;
  marca_id?: string;
  activo?: boolean;
  ubicacion_id?: string;
  busqueda_ubicacion?: string;
  exactCodigo?: string;
  stock_status?: 'ok' | 'bajo' | 'sin' | 'bajo_sin';
  filterSku?: string;
  filterNombre?: string;
  sortBy?: 'sku' | 'nombre_corto' | 'precio_venta_lista' | 'stock_fisico' | 'stock_minimo'
    | 'ubicacion_sector' | 'ubicacion_estante' | 'ubicacion_posicion';
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

// Lee y actualiza sku_proximo_secuencial atómicamente dentro de una transacción.
// Single-node; para multinodo (R4) se reemplaza por rango por nodo o generación server-side.
function nextSkuAtomico(tx: Db): { sku: string; secuencial: number } {
  const row = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).get();
  if (!row) throw new Error('sku_proximo_secuencial no encontrado en parametros_sistema');
  const secuencial = Number.parseInt(row.valor, 10);
  const sku = formatSku(secuencial);
  tx.update(schema.parametros_sistema)
    .set({ valor: String(secuencial + 1), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();
  return { sku, secuencial };
}

// PROD-3 (ADR-079): resuelve (creando si falta) la categoría raíz "Sin clasificar" para
// el alta express. Categoría normal, editable/renombrable después.
function getOrCreateCategoriaSinClasificar(db: Db, userId: string): string {
  const existente = db.select({ id: schema.categoria.id })
    .from(schema.categoria)
    .where(and(eq(schema.categoria.nombre, 'Sin clasificar'), sql`${schema.categoria.categoria_padre_id} IS NULL`))
    .get();
  if (existente) return existente.id;
  const now = new Date();
  const id = generateId();
  db.insert(schema.categoria).values({
    id, categoria_padre_id: null, nombre: 'Sin clasificar',
    descripcion: 'Productos creados por alta rápida, pendientes de clasificar',
    activo: true, usuario_creacion_id: userId, fecha_creacion: now,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return id;
}

// Unidad de venta por defecto para el alta express. crearPresentacionDefault exige que la
// abreviatura exista en el catálogo `unidad`; el seed base siembra 'unidad'. Fallback
// defensivo a la primera unidad activa.
function getUnidadDefaultAbreviatura(db: Db): string {
  const preferida = db.select({ a: schema.unidad.abreviatura }).from(schema.unidad)
    .where(eq(schema.unidad.abreviatura, 'unidad')).get();
  if (preferida) return preferida.a;
  const cualquiera = db.select({ a: schema.unidad.abreviatura }).from(schema.unidad)
    .where(eq(schema.unidad.activo, true)).get();
  if (!cualquiera) throw new Error('NO_HAY_UNIDADES');
  return cualquiera.a;
}

export function productoCreateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-082 (SEC-2): validación en el borde. Los campos requeridos primero (nombre antes
  // que categoría) para que el error reportado sea el del primer campo inválido.
  const p = (payload ?? {}) as Record<string, unknown>;
  const nombre_corto = str(p['nombre_corto'], 'nombre_corto', { max: 120 });
  const categoria_id = vId(p['categoria_id'], 'categoria_id');
  const unidad_venta = str(p['unidad_venta'], 'unidad_venta', { max: 30 });
  const impuesto_id = vId(p['impuesto_id'], 'impuesto_id');
  const precio_venta_lista = num(p['precio_venta_lista'], 'precio_venta_lista', { min: 0 });
  const nombre_largo = optStr(p['nombre_largo'], 'nombre_largo', 200);
  const marca_id = optId(p['marca_id'], 'marca_id');
  const gtin_barcode = optStr(p['gtin_barcode'], 'gtin_barcode', 20);
  const ubicacion_id = optId(p['ubicacion_id'], 'ubicacion_id');
  // Campos simples opcionales: validados sin alterar la lógica de defaults/stock inicial.
  const descripcion_tecnica = optStr(p['descripcion_tecnica'], 'descripcion_tecnica', 2000);
  const unidad_compra = optStr(p['unidad_compra'], 'unidad_compra', 30);
  const factor_conversion = num(p['factor_conversion'] ?? 1, 'factor_conversion', { min: 0 });
  const permite_fraccion = p['permite_fraccion'] !== undefined
    ? bool(p['permite_fraccion'], 'permite_fraccion') : false;
  const stock_minimo = p['stock_minimo'] != null
    ? num(p['stock_minimo'], 'stock_minimo', { min: 0 }) : 0;
  const stock_maximo = p['stock_maximo'] != null
    ? num(p['stock_maximo'], 'stock_maximo', { min: 0 }) : null;

  const now = new Date();
  const id = generateId();
  const existenciasId = generateId();
  const movimientoId = generateId();
  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  // PROD-2 (ADR-078): stock inicial opcional en el alta. Si viene con cantidad>0,
  // el movimiento 'inicial' arranca con esa cantidad y (opcional) su costo → CPP.
  const stock_inicial = p['stock_inicial'] as { cantidad: number; costo?: number } | undefined;
  const stockInicialCantidad = stock_inicial && stock_inicial.cantidad > 0
    ? stock_inicial.cantidad : 0;
  // Un `costo` en 0 (o negativo) se trata igual que "sin costo informado": el CPP queda en 0.
  const stockInicialCosto = stockInicialCantidad > 0 && stock_inicial?.costo != null && stock_inicial.costo > 0
    ? stock_inicial.costo : null;

  db.transaction((tx) => {
    const { sku, secuencial } = nextSkuAtomico(tx);

    tx.insert(schema.producto).values({
      id,
      sku,
      sku_secuencial: secuencial,
      gtin_barcode: gtin_barcode ?? null,
      nombre_corto,
      nombre_corto_norm: normalizarTermino(nombre_corto),
      nombre_largo: nombre_largo ?? nombre_corto,
      descripcion_tecnica: descripcion_tecnica ?? null,
      unidad_venta,
      unidad_compra: unidad_compra ?? null,
      factor_conversion,
      permite_fraccion,
      precio_costo_promedio: stockInicialCosto ?? 0,
      precio_venta_lista,
      impuesto_id,
      moneda: 'ARS',
      categoria_id,
      marca_id: marca_id ?? null,
      ubicacion_id: ubicacion_id ?? null,
      activo: true,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      ...sync,
    }).run();

    tx.insert(schema.existencias).values({
      id: existenciasId,
      producto_id: id,
      stock_fisico: stockInicialCantidad,
      stock_minimo,
      stock_maximo,
      ...sync,
    }).run();

    tx.insert(schema.movimiento_stock).values({
      id: movimientoId,
      producto_id: id,
      tipo: 'entrada',
      motivo: 'inicial',
      cantidad: stockInicialCantidad,
      stock_resultante: stockInicialCantidad,
      costo_unitario: stockInicialCosto,
      referencia_tipo: 'sistema',
      referencia_id: id,
      usuario_id: session.userId,
      fecha: now,
      ...sync,
    }).run();

    const presentacionId = crearPresentacionDefault(tx, id, unidad_venta, session.userId, sync.origin_id);

    // Auto-seed lista_precio_valor for each active price list
    const listasActivas = tx.select({
      id: schema.lista_precio.id,
      ajuste_porcentual: schema.lista_precio.ajuste_porcentual,
    }).from(schema.lista_precio)
      .where(eq(schema.lista_precio.activo, true))
      .all();

    const baseCs = Math.round(precio_venta_lista * 100);
    for (const lista of listasActivas) {
      tx.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: lista.id,
        producto_id: id,
        precio_centavos: Math.round(baseCs * (1 + lista.ajuste_porcentual / 100)),
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        presentacion_id: presentacionId,
        usuario_id: session.userId,
        version: 1,
        origin_id: sync.origin_id,
        sync_state: 'pending',
        updated_at: now,
      }).run();
    }
  });

  return db.select().from(schema.producto).where(eq(schema.producto.id, id)).get()!;
}

export type QuickCreateProductoPayload = {
  nombre_corto: string;
  precio_venta_lista: number;
  gtin_barcode?: string;
};

// PROD-3 (ADR-079): alta express. Resuelve los obligatorios y delega en
// productoCreateHandler (DRY: no duplica la lógica de SKU/existencias/presentación/precios).
export function productoQuickCreateHandler(db: Db, payload: QuickCreateProductoPayload) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const categoria_id = getOrCreateCategoriaSinClasificar(db, session.userId);
  const impuesto = db.select({ id: schema.impuesto.id }).from(schema.impuesto)
    .where(eq(schema.impuesto.predeterminado, true)).get();
  if (!impuesto) throw new Error('IMPUESTO_PREDETERMINADO_NO_ENCONTRADO');
  const unidad_venta = getUnidadDefaultAbreviatura(db);
  return productoCreateHandler(db, {
    nombre_corto: payload.nombre_corto,
    categoria_id,
    unidad_venta,
    impuesto_id: impuesto.id,
    precio_venta_lista: payload.precio_venta_lista,
    ...(payload.gtin_barcode ? { gtin_barcode: payload.gtin_barcode } : {}),
  });
}

export function productoStockCountsHandler(db: Db) {
  const rows = db.select({
    stock_fisico: schema.existencias.stock_fisico,
    stock_minimo: schema.existencias.stock_minimo,
  }).from(schema.producto)
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(eq(schema.producto.activo, true))
    .all();

  let ok = 0, bajo = 0, sin = 0;
  for (const p of rows) {
    const f = p.stock_fisico ?? 0;
    const m = p.stock_minimo ?? 0;
    if (f === 0) sin++;
    else if (m > 0 && f <= m) bajo++;
    else ok++;
  }
  return { ok, bajo, sin };
}

function buildStockStatusClause(stock_status: ProductoListParams['stock_status']) {
  if (stock_status === 'sin') return eq(schema.existencias.stock_fisico, 0);
  if (stock_status === 'bajo') return and(
    gt(schema.existencias.stock_fisico, 0),
    gt(schema.existencias.stock_minimo, 0),
    lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
  );
  // ADR-057: filtro combinado "Bajo mínimo + Sin stock" (default del listado de Stock).
  // Es la unión de 'sin' y 'bajo' (equivale a "todo lo que no está OK").
  if (stock_status === 'bajo_sin') return or(
    eq(schema.existencias.stock_fisico, 0),
    and(
      gt(schema.existencias.stock_fisico, 0),
      gt(schema.existencias.stock_minimo, 0),
      lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
    ),
  );
  if (stock_status === 'ok') return and(
    gt(schema.existencias.stock_fisico, 0),
    or(
      eq(schema.existencias.stock_minimo, 0),
      gt(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
    ),
  );
  return undefined;
}

function buildProductoWhereClause(
  params: ProductoListParams,
  stockStatusClause: ReturnType<typeof buildStockStatusClause>,
  matchNorm: string[] = [],
) {
  const { busqueda, exactCodigo, categoria_id, marca_id, activo, ubicacion_id, busqueda_ubicacion, filterSku, filterNombre } = params;
  // exactCodigo: discrimina SKU interno (P-NNNNNNN-C) o EAN/barcode del fabricante.
  return and(
    exactCodigo
      ? or(eq(schema.producto.sku, exactCodigo), eq(schema.producto.gtin_barcode, exactCodigo))
      : busqueda
      // ADR-067: al substring tipeado se le suman (OR) los términos NORMALIZADos —el propio
      // término y sus sinónimos— contra `nombre_corto_norm` (match acento-insensible).
      // `matchNorm` viene vacío con el flag apagado, así el comportamiento es idéntico al previo.
      ? or(
          like(schema.producto.nombre_corto, `%${busqueda}%`),
          like(schema.producto.sku, `%${busqueda}%`),
          like(schema.producto.gtin_barcode, `%${busqueda}%`),  // ADR-066: búsqueda por EAN/GTIN
          ...matchNorm.map(t => like(schema.producto.nombre_corto_norm, `%${t}%`)),
          // ADR-067: los términos normalizados también matchean la MARCA del producto
          // (p. ej. "phil"→Philips). Las marcas son ASCII → LIKE case-insensitive alcanza.
          ...matchNorm.map(t => like(schema.marca.nombre, `%${t}%`)),
        )
      : undefined,
    // Búsqueda textual de ubicación (ADR-053): por sector/estante/posición y código.
    // Sin QR ni escaneo (no reabre ADR-005/025). Requiere el leftJoin a `ubicacion`.
    busqueda_ubicacion
      ? or(
          like(schema.ubicacion.sector, `%${busqueda_ubicacion}%`),
          like(schema.ubicacion.estante, `%${busqueda_ubicacion}%`),
          like(schema.ubicacion.posicion, `%${busqueda_ubicacion}%`),
          like(schema.ubicacion.codigo, `%${busqueda_ubicacion}%`),
        )
      : undefined,
    filterSku ? like(schema.producto.sku, `%${filterSku}%`) : undefined,
    filterNombre ? like(schema.producto.nombre_corto, `%${filterNombre}%`) : undefined,
    ubicacion_id ? eq(schema.producto.ubicacion_id, ubicacion_id) : undefined,
    categoria_id ? eq(schema.producto.categoria_id, categoria_id) : undefined,
    marca_id ? eq(schema.producto.marca_id, marca_id) : undefined,
    activo !== undefined ? eq(schema.producto.activo, activo) : undefined,
    stockStatusClause,
  );
}

function buildProductoOrderClause(
  sortBy: ProductoListParams['sortBy'],
  sortDir: ProductoListParams['sortDir'],
) {
  const colByUbic =
    sortBy === 'ubicacion_sector'   ? schema.ubicacion.sector :
    sortBy === 'ubicacion_estante'  ? schema.ubicacion.estante :
    sortBy === 'ubicacion_posicion' ? schema.ubicacion.posicion :
    schema.producto.sku;
  const colByStock =
    sortBy === 'stock_fisico'      ? schema.existencias.stock_fisico :
    sortBy === 'stock_minimo'      ? schema.existencias.stock_minimo :
    sortBy === 'precio_venta_lista'? schema.producto.precio_venta_lista :
    colByUbic;
  const col =
    sortBy === 'nombre_corto' ? schema.producto.nombre_corto : colByStock;
  return sortDir === 'desc' ? desc(col) : asc(col);
}

export function productoListHandler(db: Db, params: ProductoListParams) {
  const { page, pageSize } = params;
  const stockStatusClause = buildStockStatusClause(params.stock_status);
  // ADR-067: con el flag encendido, la búsqueda textual (no el scan por código) matchea
  // acento-insensible contra nombre_corto_norm: el propio término normalizado + sus
  // sinónimos expandidos. Con el flag apagado, matchNorm=[] → búsqueda idéntica a la previa.
  const matchNorm = (params.busqueda && !params.exactCodigo && esSinonimosHabilitado(db))
    ? [normalizarTermino(params.busqueda), ...expandirTerminos(db, params.busqueda)]
        .filter((v, i, a) => v.length > 0 && a.indexOf(v) === i)
    : [];
  const where = buildProductoWhereClause(params, stockStatusClause, matchNorm);
  const orderClause = buildProductoOrderClause(params.sortBy, params.sortDir);

  const [{ total }] = db
    .select({ total: sql<number>`count(*)` })
    .from(schema.producto)
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .leftJoin(schema.ubicacion, eq(schema.ubicacion.id, schema.producto.ubicacion_id))
    .leftJoin(schema.marca, eq(schema.marca.id, schema.producto.marca_id))
    .where(where)
    .all();

  const items = db
    .select({
      id: schema.producto.id,
      sku: schema.producto.sku,
      sku_secuencial: schema.producto.sku_secuencial,
      gtin_barcode: schema.producto.gtin_barcode,
      nombre_corto: schema.producto.nombre_corto,
      nombre_largo: schema.producto.nombre_largo,
      precio_venta_lista: schema.producto.precio_venta_lista,
      unidad_venta: schema.producto.unidad_venta,
      activo: schema.producto.activo,
      categoria_id: schema.producto.categoria_id,
      marca_id: schema.producto.marca_id,
      ubicacion_id: schema.producto.ubicacion_id,
      stock_fisico: schema.existencias.stock_fisico,
      stock_minimo: schema.existencias.stock_minimo,
      ubicacion_codigo: schema.ubicacion.codigo,
      ubicacion_sector: schema.ubicacion.sector,
      ubicacion_estante: schema.ubicacion.estante,
      ubicacion_posicion: schema.ubicacion.posicion,
    })
    .from(schema.producto)
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .leftJoin(schema.ubicacion, eq(schema.ubicacion.id, schema.producto.ubicacion_id))
    .leftJoin(schema.marca, eq(schema.marca.id, schema.producto.marca_id))
    .where(where)
    .orderBy(orderClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return { items, total };
}

export type ProductoExportFiltros = {
  busqueda?: string;
  categoria_id?: string;
  marca_id?: string;
  activo?: boolean;
  ubicacion_id?: string;
  stock_status?: 'ok' | 'bajo' | 'sin' | 'bajo_sin';
};

export function productoQueryAll(db: Db, filtros: ProductoExportFiltros) {
  const { busqueda, categoria_id, marca_id, activo, ubicacion_id, stock_status } = filtros;

  const stockStatusClauseBajo = stock_status === 'bajo' ? and(
    gt(schema.existencias.stock_fisico, 0),
    gt(schema.existencias.stock_minimo, 0),
    lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
  ) : stock_status === 'ok' ? and(
    gt(schema.existencias.stock_fisico, 0),
    or(
      eq(schema.existencias.stock_minimo, 0),
      gt(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
    ),
  ) : undefined;
  // ADR-057: 'bajo_sin' = unión de "Sin stock" y "Bajo mínimo".
  const stockStatusClause =
    stock_status === 'sin' ? eq(schema.existencias.stock_fisico, 0)
    : stock_status === 'bajo_sin' ? or(
        eq(schema.existencias.stock_fisico, 0),
        and(
          gt(schema.existencias.stock_fisico, 0),
          gt(schema.existencias.stock_minimo, 0),
          lte(schema.existencias.stock_fisico, schema.existencias.stock_minimo),
        ),
      )
    : stockStatusClauseBajo;

  const where = and(
    busqueda ? or(
      like(schema.producto.nombre_corto, `%${busqueda}%`),
      like(schema.producto.sku, `%${busqueda}%`),
      like(schema.producto.gtin_barcode, `%${busqueda}%`),  // ADR-066: EAN/GTIN también en exportación
    ) : undefined,
    ubicacion_id ? eq(schema.producto.ubicacion_id, ubicacion_id) : undefined,
    categoria_id ? eq(schema.producto.categoria_id, categoria_id) : undefined,
    marca_id      ? eq(schema.producto.marca_id, marca_id)         : undefined,
    activo !== undefined ? eq(schema.producto.activo, activo) : undefined,
    stockStatusClause,
  );

  return db.select({
    id:                    schema.producto.id,
    sku:                   schema.producto.sku,
    gtin_barcode:          schema.producto.gtin_barcode,
    nombre_corto:          schema.producto.nombre_corto,
    nombre_largo:          schema.producto.nombre_largo,
    unidad_venta:          schema.producto.unidad_venta,
    precio_venta_lista:    schema.producto.precio_venta_lista,
    precio_costo_promedio: schema.producto.precio_costo_promedio,
    margen_ganancia:       schema.producto.margen_ganancia,
    activo:                schema.producto.activo,
    stock_fisico:          schema.existencias.stock_fisico,
    stock_minimo:          schema.existencias.stock_minimo,
    stock_maximo:          schema.existencias.stock_maximo,
    ubicacion_codigo:      schema.ubicacion.codigo,
    categoria_nombre:      schema.categoria.nombre,
    marca_nombre:          schema.marca.nombre,
    iva_alicuota:          schema.impuesto.alicuota,
  })
    .from(schema.producto)
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .leftJoin(schema.ubicacion,   eq(schema.ubicacion.id,            schema.producto.ubicacion_id))
    .leftJoin(schema.categoria,   eq(schema.categoria.id,            schema.producto.categoria_id))
    .leftJoin(schema.marca,       eq(schema.marca.id,                schema.producto.marca_id))
    .leftJoin(schema.impuesto,    eq(schema.impuesto.id,             schema.producto.impuesto_id))
    .where(where)
    .orderBy(asc(schema.producto.sku))
    .all();
}

export function productoGetHandler(db: Db, payload: { id: string }) {
  return db
    .select({
      ...getTableColumns(schema.producto),
      ubicacion_codigo: schema.ubicacion.codigo,
      ubicacion_sector: schema.ubicacion.sector,
      ubicacion_estante: schema.ubicacion.estante,
      ubicacion_posicion: schema.ubicacion.posicion,
    })
    .from(schema.producto)
    .leftJoin(schema.ubicacion, eq(schema.ubicacion.id, schema.producto.ubicacion_id))
    .where(eq(schema.producto.id, payload.id))
    .get() ?? null;
}

export function productoUpdateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  // ADR-082 (SEC-2): validación en el borde. Cada campo presente se valida con su primitiva.
  const p = (payload ?? {}) as Record<string, unknown>;
  const targetId = vId(p['id'], 'id');
  const now = new Date();
  // Validar TODO el payload antes de tocar la BD (boundary validation).
  const updates: Record<string, unknown> = {};
  if (p['nombre_corto'] !== undefined) updates.nombre_corto = str(p['nombre_corto'], 'nombre_corto', { max: 120 });
  if (p['nombre_largo'] !== undefined) updates.nombre_largo = optStr(p['nombre_largo'], 'nombre_largo', 200) ?? null;
  if (p['descripcion_tecnica'] !== undefined) updates.descripcion_tecnica = optStr(p['descripcion_tecnica'], 'descripcion_tecnica', 2000) ?? null;
  if (p['categoria_id'] !== undefined) updates.categoria_id = vId(p['categoria_id'], 'categoria_id');
  if (p['marca_id'] !== undefined) updates.marca_id = optId(p['marca_id'], 'marca_id') ?? null;
  if (p['unidad_venta'] !== undefined) updates.unidad_venta = str(p['unidad_venta'], 'unidad_venta', { max: 30 });
  if (p['unidad_compra'] !== undefined) updates.unidad_compra = optStr(p['unidad_compra'], 'unidad_compra', 30) ?? null;
  if (p['factor_conversion'] !== undefined) updates.factor_conversion = num(p['factor_conversion'], 'factor_conversion', { min: 0 });
  if (p['permite_fraccion'] !== undefined) updates.permite_fraccion = bool(p['permite_fraccion'], 'permite_fraccion');
  if (p['gtin_barcode'] !== undefined) updates.gtin_barcode = optStr(p['gtin_barcode'], 'gtin_barcode', 20) ?? null;
  if (p['impuesto_id'] !== undefined) updates.impuesto_id = vId(p['impuesto_id'], 'impuesto_id');
  if (p['precio_venta_lista'] !== undefined) updates.precio_venta_lista = num(p['precio_venta_lista'], 'precio_venta_lista', { min: 0 });
  if (p['ubicacion_id'] !== undefined) updates.ubicacion_id = optId(p['ubicacion_id'], 'ubicacion_id') ?? null;
  // ADR-067: mantener la proyección normalizada en sync cuando cambia el nombre.
  if (updates.nombre_corto !== undefined) {
    updates.nombre_corto_norm = normalizarTermino(updates.nombre_corto as string);
  }
  const existing = db
    .select()
    .from(schema.producto)
    .where(eq(schema.producto.id, targetId))
    .get();
  if (!existing) throw new Error('NOT_FOUND');
  updates.version = existing.version + 1;
  updates.sync_state = 'pending';
  updates.updated_at = now;
  updates.usuario_modificacion_id = session.userId;
  updates.fecha_actualizacion = now;
  db.update(schema.producto).set(updates).where(eq(schema.producto.id, targetId)).run();
  return db.select().from(schema.producto).where(eq(schema.producto.id, targetId)).get()!;
}

export function productoDeactivateHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db
    .select()
    .from(schema.producto)
    .where(eq(schema.producto.id, payload.id))
    .get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.producto).set({
    activo: false,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  }).where(eq(schema.producto.id, payload.id)).run();
}

export function setDiscontinuadoHandler(db: Db, params: { id: string; discontinuado: boolean }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  db.update(schema.producto)
    .set({ discontinuado: params.discontinuado, updated_at: new Date(), sync_state: 'pending' })
    .where(eq(schema.producto.id, params.id))
    .run();
  return db.select().from(schema.producto).where(eq(schema.producto.id, params.id)).get()!;
}

export type BuscarSimilaresParams = { texto: string; clienteId?: string; limite?: number; piso?: number };

export type CandidatoSimilarEnriquecido = {
  producto_id: string;
  sku: string;
  nombre_corto: string;
  marca_nombre: string | null;
  precio_final_centavos: number;
  precio_origen: 'promocion' | 'vigente' | 'fallback';
  stock_fisico: number;
  score: number;
};

// Factor de la presentación default (unidad por defecto). 1.0 si no hay presentación default.
function factorPresentacionDefault(db: Db, productoId: string): number {
  const pp = db.select({ factor: schema.producto_presentacion.factor_a_stock })
    .from(schema.producto_presentacion)
    .where(and(
      eq(schema.producto_presentacion.producto_id, productoId),
      eq(schema.producto_presentacion.es_default, true),
      eq(schema.producto_presentacion.activo, true),
    ))
    .get();
  return pp?.factor ?? 1.0;
}

// ADR búsqueda por similitud — Servicio ÚNICO enriquecido. Reutiliza el matcher token-set de
// ADR-063 para rankear, y luego hidrata los ≤N candidatos con stock, marca y el PRECIO FINAL
// informado al cliente (mismo camino que addLinea: getPrecioEnLista × factor de presentación
// default). Nunca match automático: sólo sugerencias, la selección es humana. Consumido por
// Catálogo (revisar duplicados / por característica) y por el POS (modo Buscar similares).
export function buscarSimilaresHandler(db: Db, params: BuscarSimilaresParams): CandidatoSimilarEnriquecido[] {
  const texto = (params?.texto ?? '').trim();
  if (!texto) return [];
  const opts: { limite?: number; piso?: number } = {};
  if (params.limite !== undefined) opts.limite = params.limite;
  if (params.piso !== undefined) opts.piso = params.piso;

  const base = crearMatcher(db).sugerir(texto, opts); // ordenado por score desc
  if (base.length === 0) return [];

  const ids = base.map(c => c.producto_id);
  const filas = db.select({
    id: schema.producto.id,
    precio_venta_lista: schema.producto.precio_venta_lista,
    marca_nombre: schema.marca.nombre,
    stock_fisico: schema.existencias.stock_fisico,
  }).from(schema.producto)
    .leftJoin(schema.marca, eq(schema.marca.id, schema.producto.marca_id))
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(inArray(schema.producto.id, ids))
    .all();
  const porId = new Map(filas.map(f => [f.id, f]));

  const predeterminada = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio)
    .where(eq(schema.lista_precio.predeterminada, true))
    .get();

  return base.map((c) => {
    const f = porId.get(c.producto_id);
    const factor = factorPresentacionDefault(db, c.producto_id);
    let precioBaseCentavos: number;
    let origen: 'promocion' | 'vigente' | 'fallback';
    if (predeterminada) {
      const r = getPrecioEnListaHandler(db, {
        productoId: c.producto_id,
        listaId: predeterminada.id,
        ...(params.clienteId !== undefined ? { clienteId: params.clienteId } : {}),
      });
      precioBaseCentavos = r.precio_centavos;
      origen = r.origen;
    } else {
      precioBaseCentavos = Math.round((f?.precio_venta_lista ?? 0) * 100);
      origen = 'fallback';
    }
    return {
      producto_id: c.producto_id,
      sku: c.sku,
      nombre_corto: c.nombre_corto,
      marca_nombre: f?.marca_nombre ?? null,
      precio_final_centavos: Math.round(precioBaseCentavos * factor),
      precio_origen: origen,
      stock_fisico: f?.stock_fisico ?? 0,
      score: c.score,
    };
  });
}

export function registerProductoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('producto:list',        async (_e, p) => productoListHandler(db, p));
  ipcMain.handle('producto:buscarSimilares', async (_e, p) => buscarSimilaresHandler(db, p));
  ipcMain.handle('producto:stockCounts', async ()      => productoStockCountsHandler(db));
  ipcMain.handle('producto:get', async (_e, p) => productoGetHandler(db, p));
  ipcMain.handle('producto:create', async (_e, p) => productoCreateHandler(db, p));
  ipcMain.handle('producto:quickCreate', async (_e, p) => productoQuickCreateHandler(db, p));
  ipcMain.handle('producto:update', async (_e, p) => productoUpdateHandler(db, p));
  ipcMain.handle('producto:deactivate', async (_e, p) => productoDeactivateHandler(db, p));
  ipcMain.handle('producto:setDiscontinuado', async (_e, p) => setDiscontinuadoHandler(db, p));
}
