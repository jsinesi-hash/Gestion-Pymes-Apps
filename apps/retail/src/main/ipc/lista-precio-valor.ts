import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, centavos, id as vId, resolverListaEfectiva, requirePermission } from '@core/main';
import { getDefaultPresentacionId } from './presentacion';

type Db = BetterSQLite3Database<typeof schema>;

// ── Types ────────────────────────────────────────────────────────────────────

export type PrecioResuelto = {
  precio_centavos: number;
  origen: 'promocion' | 'vigente' | 'fallback';
};

export type RecalcularMasivoParams = {
  lista_precio_id: string;
  porcentaje: number;
  base_calculo: 'precio_lista' | 'costo_proveedor' | 'lista';
  base_lista_id?: string | undefined;
  alcance: 'catalogo' | 'rubro' | 'marca' | 'proveedor';
  alcance_id?: string | undefined;
  excluir_manuales_dias?: number | undefined;
};

// ── getPrecioEnLista ─────────────────────────────────────────────────────────

// ADR-104: el resolver pasó a @core/main; se re-exporta para no tocar a los consumidores de Retail.
export { resolverListaEfectiva };

export function getPrecioEnListaHandler(
  db: Db,
  { productoId, listaId, clienteId }: { productoId: string; listaId: string; clienteId?: string },
): PrecioResuelto {
  const listaEfectivaId = resolverListaEfectiva(db, clienteId, listaId);
  const now = new Date();

  // Step 1: active promotion takes precedence
  const promo = db.select().from(schema.promocion)
    .where(and(
      eq(schema.promocion.lista_precio_id, listaEfectivaId),
      eq(schema.promocion.producto_id, productoId),
      eq(schema.promocion.activo, true),
      lte(schema.promocion.fecha_desde, now),
      gte(schema.promocion.fecha_hasta, now),
    ))
    .get();

  if (promo) {
    return { precio_centavos: promo.precio_centavos, origen: 'promocion' };
  }

  // Step 2: vigente row (fecha_hasta IS NULL)
  const vigente = db.select().from(schema.lista_precio_valor)
    .where(and(
      eq(schema.lista_precio_valor.lista_precio_id, listaEfectivaId),
      eq(schema.lista_precio_valor.producto_id, productoId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    ))
    .get();

  if (vigente) {
    return { precio_centavos: vigente.precio_centavos, origen: 'vigente' };
  }

  // Step 3: fallback = producto.precio_venta_lista * 100 * (1 + lista.ajuste_porcentual/100)
  const prod = db.select().from(schema.producto)
    .where(eq(schema.producto.id, productoId))
    .get();
  const lista = db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, listaEfectivaId))
    .get();

  if (!prod || !lista) {
    throw new Error('NOT_FOUND');
  }

  const precio_centavos = Math.round(
    prod.precio_venta_lista * 100 * (1 + lista.ajuste_porcentual / 100),
  );

  return { precio_centavos, origen: 'fallback' };
}

// ── setManual ────────────────────────────────────────────────────────────────

export function setManualHandler(
  db: Db,
  rawPayload: unknown,
): void {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-082 (SEC-2): valida forma/tipo del payload antes de tocar la BD.
  // presentacion_id no se valida: el handler la resuelve internamente vía
  // getDefaultPresentacionId, no viene en el payload.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const listaId = vId(p['listaId'], 'listaId');
  const productoId = vId(p['productoId'], 'productoId');
  const precioCentavos = centavos(p['precioCentavos'], 'precioCentavos');

  const now = new Date();

  db.transaction((tx) => {
    // Close existing vigente row
    tx.update(schema.lista_precio_valor)
      .set({ fecha_hasta: now, updated_at: now })
      .where(and(
        eq(schema.lista_precio_valor.lista_precio_id, listaId),
        eq(schema.lista_precio_valor.producto_id, productoId),
        isNull(schema.lista_precio_valor.fecha_hasta),
      ))
      .run();

    const presentacionId = getDefaultPresentacionId(tx as Db, productoId);

    // Insert new vigente row
    tx.insert(schema.lista_precio_valor).values({
      id: generateId(),
      lista_precio_id: listaId,
      producto_id: productoId,
      precio_centavos: precioCentavos,
      fecha_desde: now,
      fecha_hasta: null,
      origen: 'manual',
      recalculo_masivo_id: null,
      presentacion_id: presentacionId,
      usuario_id: session.userId,
      version: 1,
      origin_id: getOriginId(),
      sync_state: 'pending',
      updated_at: now,
    }).run();
  });
}

// ── listarVigentesParaProducto ────────────────────────────────────────────────

export type VigenteConListaNombre = {
  id: string;
  lista_precio_id: string;
  lista_nombre: string;
  producto_id: string;
  precio_centavos: number;
  fecha_desde: Date;
  origen: string;
};

export function listarVigentesParaProductoHandler(
  db: Db,
  productoId: string,
): VigenteConListaNombre[] {
  const rows = db.select({
    id: schema.lista_precio_valor.id,
    lista_precio_id: schema.lista_precio_valor.lista_precio_id,
    lista_nombre: schema.lista_precio.nombre,
    producto_id: schema.lista_precio_valor.producto_id,
    precio_centavos: schema.lista_precio_valor.precio_centavos,
    fecha_desde: schema.lista_precio_valor.fecha_desde,
    origen: schema.lista_precio_valor.origen,
  })
    .from(schema.lista_precio_valor)
    .innerJoin(
      schema.lista_precio,
      eq(schema.lista_precio_valor.lista_precio_id, schema.lista_precio.id),
    )
    .where(and(
      eq(schema.lista_precio_valor.producto_id, productoId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    ))
    .all();

  return rows;
}

// ── listarVigentesPorLista ────────────────────────────────────────────────────

export type VigenteConProducto = {
  id: string;
  producto_id: string;
  nombre_corto: string;
  sku: string;
  gtin_barcode: string | null;
  lista_precio_id: string;
  precio_centavos: number;
  fecha_desde: Date;
  origen: string;
  precio_promocion_centavos?: number | null;
  promocion_hasta?: Date | null;
};

export function listarVigentesPorListaHandler(
  db: Db,
  listaId: string,
): VigenteConProducto[] {
  const rows = db.select({
    id: schema.lista_precio_valor.id,
    producto_id: schema.lista_precio_valor.producto_id,
    nombre_corto: schema.producto.nombre_corto,
    sku: schema.producto.sku,
    gtin_barcode: schema.producto.gtin_barcode,
    lista_precio_id: schema.lista_precio_valor.lista_precio_id,
    precio_centavos: schema.lista_precio_valor.precio_centavos,
    fecha_desde: schema.lista_precio_valor.fecha_desde,
    origen: schema.lista_precio_valor.origen,
  })
    .from(schema.lista_precio_valor)
    .innerJoin(
      schema.producto,
      eq(schema.lista_precio_valor.producto_id, schema.producto.id),
    )
    .where(and(
      eq(schema.lista_precio_valor.lista_precio_id, listaId),
      isNull(schema.lista_precio_valor.fecha_hasta),
    ))
    .all();

  const now = new Date();

  return rows.map((row) => {
    const promo = db.select().from(schema.promocion)
      .where(and(
        eq(schema.promocion.lista_precio_id, listaId),
        eq(schema.promocion.producto_id, row.producto_id),
        eq(schema.promocion.activo, true),
        lte(schema.promocion.fecha_desde, now),
        gte(schema.promocion.fecha_hasta, now),
      ))
      .get();

    return {
      ...row,
      precio_promocion_centavos: promo?.precio_centavos ?? null,
      promocion_hasta: promo?.fecha_hasta ?? null,
    };
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────────

export function resolveProductosAfectados(
  db: Db,
  params: RecalcularMasivoParams,
): { id: string; precio_venta_lista: number }[] {
  const { alcance, alcance_id, lista_precio_id, excluir_manuales_dias } = params;

  // Fetch all active products matching the scope
  let productos: { id: string; precio_venta_lista: number }[];

  if (alcance === 'catalogo') {
    productos = db.select({
      id: schema.producto.id,
      precio_venta_lista: schema.producto.precio_venta_lista,
    })
      .from(schema.producto)
      .where(eq(schema.producto.activo, true))
      .all();
  } else if (alcance === 'rubro') {
    if (!alcance_id) throw new Error('alcance_id required for rubro');
    productos = db.select({
      id: schema.producto.id,
      precio_venta_lista: schema.producto.precio_venta_lista,
    })
      .from(schema.producto)
      .where(and(
        eq(schema.producto.activo, true),
        eq(schema.producto.categoria_id, alcance_id),
      ))
      .all();
  } else if (alcance === 'marca') {
    if (!alcance_id) throw new Error('alcance_id required for marca');
    productos = db.select({
      id: schema.producto.id,
      precio_venta_lista: schema.producto.precio_venta_lista,
    })
      .from(schema.producto)
      .where(and(
        eq(schema.producto.activo, true),
        eq(schema.producto.marca_id, alcance_id),
      ))
      .all();
  } else if (alcance === 'proveedor') {
    if (!alcance_id) throw new Error('alcance_id required for proveedor');
    productos = db.select({
      id: schema.producto.id,
      precio_venta_lista: schema.producto.precio_venta_lista,
    })
      .from(schema.producto)
      .innerJoin(
        schema.producto_proveedor,
        eq(schema.producto.id, schema.producto_proveedor.producto_id),
      )
      .where(and(
        eq(schema.producto.activo, true),
        eq(schema.producto_proveedor.proveedor_id, alcance_id),
      ))
      .all();
  } else {
    throw new Error(`alcance no soportado: ${alcance}`);
  }

  // Filter out products with a recent manual vigente row
  if (excluir_manuales_dias && excluir_manuales_dias > 0) {
    const cutoff = new Date(Date.now() - excluir_manuales_dias * 24 * 3600 * 1000);

    // Get product IDs that have a recent manual vigente row
    const recentManualRows = db.select({
      producto_id: schema.lista_precio_valor.producto_id,
    })
      .from(schema.lista_precio_valor)
      .where(and(
        eq(schema.lista_precio_valor.lista_precio_id, lista_precio_id),
        isNull(schema.lista_precio_valor.fecha_hasta),
        eq(schema.lista_precio_valor.origen, 'manual'),
        gte(schema.lista_precio_valor.fecha_desde, cutoff),
      ))
      .all();

    const excludedIds = new Set(recentManualRows.map((r) => r.producto_id));
    productos = productos.filter((p) => !excludedIds.has(p.id));
  }

  return productos;
}

function resolveBaseCentavos(
  db: Db,
  prod: { id: string; precio_venta_lista: number },
  params: RecalcularMasivoParams,
): number {
  if (params.base_calculo === 'precio_lista') {
    return Math.round(prod.precio_venta_lista * 100);
  }

  if (params.base_calculo === 'costo_proveedor') {
    const pp = db.select().from(schema.producto_proveedor)
      .where(and(
        eq(schema.producto_proveedor.producto_id, prod.id),
        eq(schema.producto_proveedor.preferido, true),
      ))
      .get();
    if (!pp) return Math.round(prod.precio_venta_lista * 100); // fallback
    return pp.costo_centavos;
  }

  if (params.base_calculo === 'lista') {
    if (!params.base_lista_id) throw new Error('base_lista_id required for base_calculo=lista');
    const vigente = db.select().from(schema.lista_precio_valor)
      .where(and(
        eq(schema.lista_precio_valor.lista_precio_id, params.base_lista_id),
        eq(schema.lista_precio_valor.producto_id, prod.id),
        isNull(schema.lista_precio_valor.fecha_hasta),
      ))
      .get();
    if (!vigente) {
      // Fallback to precio_lista if no vigente row
      return Math.round(prod.precio_venta_lista * 100);
    }
    return vigente.precio_centavos;
  }

  throw new Error(`base_calculo no soportado: ${params.base_calculo}`);
}

// ── contarAfectados ───────────────────────────────────────────────────────────

export function contarAfectadosHandler(db: Db, params: RecalcularMasivoParams): number {
  return resolveProductosAfectados(db, params).length;
}

// ── recalcularMasivo ──────────────────────────────────────────────────────────

export function recalcularMasivoHandler(
  db: Db,
  params: RecalcularMasivoParams,
  callerUserId?: string,
): { recalculo_masivo_id: string; productos_afectados: number } {
  const session = getSession();
  const userId = callerUserId ?? session?.userId;
  if (!userId) throw new Error('UNAUTHENTICATED');

  const productos = resolveProductosAfectados(db, params);
  const now = new Date();
  const recalculoId = generateId();

  db.transaction((tx) => {
    for (const prod of productos) {
      // Safe cast: better-sqlite3 transactions are synchronous; tx exposes identical query methods to db.
      const baseCentavos = resolveBaseCentavos(tx as Db, prod, params);
      const nuevoPrecio = Math.round(baseCentavos * (1 + params.porcentaje / 100));

      // Close existing vigente row
      tx.update(schema.lista_precio_valor)
        .set({ fecha_hasta: now, updated_at: now })
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, params.lista_precio_id),
          eq(schema.lista_precio_valor.producto_id, prod.id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        ))
        .run();

      const presentacionId = getDefaultPresentacionId(tx as Db, prod.id);

      // Insert new vigente row
      tx.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: params.lista_precio_id,
        producto_id: prod.id,
        precio_centavos: nuevoPrecio,
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'recalculo',
        recalculo_masivo_id: recalculoId,
        presentacion_id: presentacionId,
        usuario_id: userId,
        version: 1,
        origin_id: getOriginId(),
        sync_state: 'pending',
        updated_at: now,
      }).run();
    }

    // Register the recalculo_masivo record
    tx.insert(schema.recalculo_masivo).values({
      id: recalculoId,
      lista_precio_id: params.lista_precio_id,
      porcentaje: params.porcentaje,
      base_calculo: params.base_calculo,
      base_lista_id: params.base_lista_id ?? null,
      base_valor_centavos: null,
      alcance: params.alcance,
      alcance_id: params.alcance_id ?? null,
      excluir_manuales_dias: params.excluir_manuales_dias ?? null,
      productos_afectados: productos.length,
      estado: 'aplicado',
      usuario_id: userId,
      fecha_ejecucion: now,
      observaciones: null,
      version: 1,
      origin_id: getOriginId(),
      sync_state: 'pending',
      updated_at: now,
    }).run();
  });

  return { recalculo_masivo_id: recalculoId, productos_afectados: productos.length };
}

// ── registerListaPrecioValorHandlers ─────────────────────────────────────────

export function registerListaPrecioValorHandlers(ipcMain: IpcMain, db: Db): void {
  // Revisión 2026-10-20 (P0): fijar o recalcular precios es `config.fiscal` (solo Supervisor,
  // CLAUDE.md §8). Se gatea en el canal y no en el handler porque el scheduler de cambios
  // programados llama a `recalcularMasivoHandler` sin sesión (callerUserId).
  const guard = requirePermission('precio.gestionar');

  ipcMain.handle('listaPrecioValor:getPrecioEnLista', async (_e, p) =>
    getPrecioEnListaHandler(db, p));
  ipcMain.handle('listaPrecioValor:setManual', guard(async (_e, p) =>
    setManualHandler(db, p)));
  ipcMain.handle('listaPrecioValor:listarVigentesParaProducto', async (_e, productoId) =>
    listarVigentesParaProductoHandler(db, productoId));
  ipcMain.handle('listaPrecioValor:listarVigentesPorLista', async (_e, listaId) =>
    listarVigentesPorListaHandler(db, listaId));
  ipcMain.handle('listaPrecioValor:contarAfectados', async (_e, p) =>
    contarAfectadosHandler(db, p));
  ipcMain.handle('listaPrecioValor:recalcularMasivo', guard(async (_e, p) =>
    recalcularMasivoHandler(db, p)));
}
