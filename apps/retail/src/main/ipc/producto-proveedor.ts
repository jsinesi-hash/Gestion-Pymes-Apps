import { eq, and, isNull } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession, getOriginId, requirePermission, id, centavos, optStr, num, bool } from '@core/main';
import { crearBatchesPorEventoDeCosto } from '../precios/motor';

type Db = BetterSQLite3Database<typeof schema>;

export function productoProveedorListHandler(db: Db, productoId: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return db.select({
    id:               schema.producto_proveedor.id,
    proveedor_id:     schema.producto_proveedor.proveedor_id,
    razon_social:     schema.proveedor.razon_social,
    costo_centavos:   schema.producto_proveedor.costo_centavos,
    codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
    preferido:        schema.producto_proveedor.preferido,
    // ADR-049 §1 — overrides por producto (null = hereda) + defaults del proveedor,
    // para que el renderer calcule el costo neto con @ferreteria/shared.
    bonificacion_pct:      schema.producto_proveedor.bonificacion_pct,
    costo_financiero_pct:  schema.producto_proveedor.costo_financiero_pct,
    flete_pct:             schema.producto_proveedor.flete_pct,
    flete_centavos:        schema.producto_proveedor.flete_centavos,
    otros_costos_centavos: schema.producto_proveedor.otros_costos_centavos,
    bonificacion_pct_default:     schema.proveedor.bonificacion_pct_default,
    costo_financiero_pct_default: schema.proveedor.costo_financiero_pct_default,
    flete_pct_default:            schema.proveedor.flete_pct_default,
  })
    .from(schema.producto_proveedor)
    .innerJoin(schema.proveedor, eq(schema.producto_proveedor.proveedor_id, schema.proveedor.id))
    .where(and(
      eq(schema.producto_proveedor.producto_id, productoId),
      isNull(schema.producto_proveedor.deleted_at),
    ))
    .all();
}

function pctOrNull(v: unknown, field: string): number | null {
  if (v === null) return null;
  return num(v, field);
}
function centavosOrNull(v: unknown, field: string): number | null {
  if (v === null) return null;
  return centavos(v, field);
}

export function productoProveedorSetOverridesHandler(
  db: Db,
  idArg: unknown,
  patch: unknown,
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const v_id = id(idArg, 'id');
  const pt = (patch ?? {}) as Record<string, unknown>;
  const v_bonificacion_pct      = pctOrNull(pt['bonificacion_pct'], 'bonificacion_pct');
  const v_costo_financiero_pct  = pctOrNull(pt['costo_financiero_pct'], 'costo_financiero_pct');
  const v_flete_pct             = pctOrNull(pt['flete_pct'], 'flete_pct');
  const v_flete_centavos        = centavosOrNull(pt['flete_centavos'], 'flete_centavos');
  const v_otros_costos_centavos = centavosOrNull(pt['otros_costos_centavos'], 'otros_costos_centavos');
  const v_costo_centavos = pt['costo_centavos'] !== undefined ? centavos(pt['costo_centavos'], 'costo_centavos') : undefined;

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  db.update(schema.producto_proveedor).set({
    bonificacion_pct:      v_bonificacion_pct,
    costo_financiero_pct:  v_costo_financiero_pct,
    flete_pct:             v_flete_pct,
    flete_centavos:        v_flete_centavos,
    otros_costos_centavos: v_otros_costos_centavos,
    ...(v_costo_centavos !== undefined && { costo_centavos: v_costo_centavos }),
    ...sync,
  }).where(eq(schema.producto_proveedor.id, v_id)).run();
  return { id: v_id };
}

export function productoProveedorUpsertHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_producto_id      = id(p['producto_id'], 'producto_id');
  const v_proveedor_id     = id(p['proveedor_id'], 'proveedor_id');
  const v_costo_centavos   = centavos(p['costo_centavos'], 'costo_centavos');
  const v_codigo_proveedor = optStr(p['codigo_proveedor'], 'codigo_proveedor', 100);

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  const existing = db.select({ id: schema.producto_proveedor.id })
    .from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, v_producto_id),
      eq(schema.producto_proveedor.proveedor_id, v_proveedor_id),
    ))
    .get();

  if (existing) {
    db.update(schema.producto_proveedor).set({
      costo_centavos:   v_costo_centavos,
      codigo_proveedor: v_codigo_proveedor ?? null,
      deleted_at:       null,
      ...sync,
    }).where(eq(schema.producto_proveedor.id, existing.id)).run();
    return { id: existing.id };
  }

  const nuevoId = generateId();
  db.insert(schema.producto_proveedor).values({
    id: nuevoId,
    producto_id:      v_producto_id,
    proveedor_id:     v_proveedor_id,
    costo_centavos:   v_costo_centavos,
    codigo_proveedor: v_codigo_proveedor ?? null,
    preferido:        false,
    usuario_creacion_id: session.userId,
    fecha_creacion:   now,
    ...sync,
  }).run();
  return { id: nuevoId };
}

export function productoProveedorSetPreferidoHandler(db: Db, idArg: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const v_id = id(idArg, 'id');
  const now = new Date();

  const row = db.select({ producto_id: schema.producto_proveedor.producto_id, proveedor_id: schema.producto_proveedor.proveedor_id })
    .from(schema.producto_proveedor)
    .where(eq(schema.producto_proveedor.id, v_id))
    .get();
  if (!row) return { id: v_id };

  // ADR-036 — desmarcar el preferido anterior y marcar el nuevo en la MISMA
  // transacción: el índice único parcial (ux_producto_proveedor_preferido) exige
  // limpiar antes de setear, y la transacción evita la ventana de "cero preferidos"
  // si el proceso cae entre ambos statements.
  db.transaction((tx) => {
    tx.update(schema.producto_proveedor)
      .set({ preferido: false, updated_at: now })
      .where(and(
        eq(schema.producto_proveedor.producto_id, row.producto_id),
        isNull(schema.producto_proveedor.deleted_at),
      ))
      .run();

    tx.update(schema.producto_proveedor)
      .set({ preferido: true, updated_at: now })
      .where(eq(schema.producto_proveedor.id, v_id))
      .run();
  });

  // ADR-049 §7 — cambio de preferido dispara un batch acotado a ese producto (solo listas
  // en modo margen_costo; con todas en pct_sobre_lista no genera nada).
  try {
    crearBatchesPorEventoDeCosto(db, {
      producto_ids: [row.producto_id],
      origen: 'SUPPLIER_CHANGE',
      proveedor_id: row.proveedor_id,
      referencia_tipo: 'producto_proveedor',
      referencia_id: v_id,
    }, session.userId);
  } catch (e) {
    console.error('[precios] Error generando batch por cambio de preferido:', e);
  }

  return { id: v_id };
}

export function productoProveedorRemoveHandler(db: Db, idArg: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const v_id = id(idArg, 'id');
  const now = new Date();
  db.update(schema.producto_proveedor).set({
    preferido:  false,
    deleted_at: now,
    updated_at: now,
  }).where(eq(schema.producto_proveedor.id, v_id)).run();
  return { id: v_id };
}

// ── handlers centric al proveedor (ADR-036) ──────────────────────────────────

export function proveedorProductosListarHandler(db: Db, proveedorId: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return db.select({
    id:               schema.producto_proveedor.id,
    producto_id:      schema.producto_proveedor.producto_id,
    nombre_corto:     schema.producto.nombre_corto,
    sku:              schema.producto.sku,
    costo_centavos:   schema.producto_proveedor.costo_centavos,
    codigo_proveedor: schema.producto_proveedor.codigo_proveedor,
    preferido:        schema.producto_proveedor.preferido,
    // ADR-049 §1 — overrides + defaults para mostrar el costo neto efectivo (solo lectura).
    bonificacion_pct:      schema.producto_proveedor.bonificacion_pct,
    costo_financiero_pct:  schema.producto_proveedor.costo_financiero_pct,
    flete_pct:             schema.producto_proveedor.flete_pct,
    flete_centavos:        schema.producto_proveedor.flete_centavos,
    otros_costos_centavos: schema.producto_proveedor.otros_costos_centavos,
    bonificacion_pct_default:     schema.proveedor.bonificacion_pct_default,
    costo_financiero_pct_default: schema.proveedor.costo_financiero_pct_default,
    flete_pct_default:            schema.proveedor.flete_pct_default,
  })
    .from(schema.producto_proveedor)
    .innerJoin(schema.producto, eq(schema.producto_proveedor.producto_id, schema.producto.id))
    .innerJoin(schema.proveedor, eq(schema.producto_proveedor.proveedor_id, schema.proveedor.id))
    .where(and(
      eq(schema.producto_proveedor.proveedor_id, proveedorId),
      isNull(schema.producto_proveedor.deleted_at),
    ))
    .all();
}

export function proveedorProductosAsociarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_producto_id      = id(p['producto_id'], 'producto_id');
  const v_proveedor_id     = id(p['proveedor_id'], 'proveedor_id');
  const v_costo_centavos   = centavos(p['costo_centavos'], 'costo_centavos');
  const v_codigo_proveedor = optStr(p['codigo_proveedor'], 'codigo_proveedor', 100);

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  const existing = db.select({ id: schema.producto_proveedor.id })
    .from(schema.producto_proveedor)
    .where(and(
      eq(schema.producto_proveedor.producto_id, v_producto_id),
      eq(schema.producto_proveedor.proveedor_id, v_proveedor_id),
    ))
    .get();

  if (existing) {
    db.update(schema.producto_proveedor).set({
      costo_centavos:   v_costo_centavos,
      codigo_proveedor: v_codigo_proveedor ?? null,
      deleted_at:       null,
      ...sync,
    }).where(eq(schema.producto_proveedor.id, existing.id)).run();
    return { id: existing.id };
  }

  const nuevoId = generateId();
  db.insert(schema.producto_proveedor).values({
    id: nuevoId,
    producto_id:         v_producto_id,
    proveedor_id:        v_proveedor_id,
    costo_centavos:      v_costo_centavos,
    codigo_proveedor:    v_codigo_proveedor ?? null,
    preferido:           false,
    usuario_creacion_id: session.userId,
    fecha_creacion:      now,
    ...sync,
  }).run();
  return { id: nuevoId };
}

export type ProveedorProductosAsociarLotePayload = {
  proveedor_id: string;
  items: Array<{ producto_id: string; costo_centavos: number; codigo_proveedor?: string }>;
};

/**
 * ADR-083 — alta masiva de productos en un proveedor. Aplica todas las altas en una sola
 * transacción, reusando la semántica idempotente de `asociar` por ítem (revive soft-deleted,
 * no pisa `preferido`). Devuelve cuántos vínculos quedaron asociados.
 */
export function proveedorProductosAsociarLoteHandler(db: Db, payload: ProveedorProductosAsociarLotePayload) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  let asociados = 0;
  db.transaction((tx) => {
    for (const item of payload.items) {
      const existing = tx.select({ id: schema.producto_proveedor.id })
        .from(schema.producto_proveedor)
        .where(and(
          eq(schema.producto_proveedor.producto_id, item.producto_id),
          eq(schema.producto_proveedor.proveedor_id, payload.proveedor_id),
        ))
        .get();

      if (existing) {
        tx.update(schema.producto_proveedor).set({
          costo_centavos:   item.costo_centavos,
          codigo_proveedor: item.codigo_proveedor ?? null,
          deleted_at:       null,
          ...sync,
        }).where(eq(schema.producto_proveedor.id, existing.id)).run();
      } else {
        tx.insert(schema.producto_proveedor).values({
          id: generateId(),
          producto_id:         item.producto_id,
          proveedor_id:        payload.proveedor_id,
          costo_centavos:      item.costo_centavos,
          codigo_proveedor:    item.codigo_proveedor ?? null,
          preferido:           false,
          usuario_creacion_id: session.userId,
          fecha_creacion:      now,
          ...sync,
        }).run();
      }
      asociados++;
    }
  });
  return { asociados };
}

export function proveedorProductosDesasociarHandler(db: Db, idArg: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const v_id = id(idArg, 'id');
  const now = new Date();
  db.update(schema.producto_proveedor).set({
    preferido:  false,
    deleted_at: now,
    updated_at: now,
  }).where(eq(schema.producto_proveedor.id, v_id)).run();
  return { id: v_id };
}

export function proveedorProductosActualizarHandler(
  db: Db,
  idArg: unknown,
  patch: unknown,
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD. Patch de campos
  // presentes-solamente (semántica previa: solo se tocan las claves que vienen).
  const v_id = id(idArg, 'id');
  const pt = (patch ?? {}) as Record<string, unknown>;
  const v_costo_centavos = pt['costo_centavos'] !== undefined
    ? centavos(pt['costo_centavos'], 'costo_centavos')
    : undefined;
  const v_codigo_proveedor = pt['codigo_proveedor'] === undefined
    ? undefined
    : pt['codigo_proveedor'] === null
      ? null
      : (optStr(pt['codigo_proveedor'], 'codigo_proveedor', 100) ?? null);
  const v_preferido = pt['preferido'] !== undefined ? bool(pt['preferido'], 'preferido') : undefined;

  const now = new Date();

  if (v_preferido === true) {
    const row = db.select({ producto_id: schema.producto_proveedor.producto_id, proveedor_id: schema.producto_proveedor.proveedor_id })
      .from(schema.producto_proveedor)
      .where(eq(schema.producto_proveedor.id, v_id))
      .get();
    if (!row) return { id: v_id };

    db.transaction((tx) => {
      tx.update(schema.producto_proveedor)
        .set({ preferido: false, updated_at: now })
        .where(and(
          eq(schema.producto_proveedor.producto_id, row.producto_id),
          isNull(schema.producto_proveedor.deleted_at),
        ))
        .run();
      tx.update(schema.producto_proveedor).set({
        preferido: true,
        ...(v_costo_centavos   !== undefined && { costo_centavos:   v_costo_centavos }),
        ...(v_codigo_proveedor !== undefined && { codigo_proveedor: v_codigo_proveedor }),
        updated_at: now,
      }).where(eq(schema.producto_proveedor.id, v_id)).run();
    });

    // ADR-049 §7 — cambio de preferido dispara un batch acotado a ese producto.
    try {
      crearBatchesPorEventoDeCosto(db, {
        producto_ids: [row.producto_id],
        origen: 'SUPPLIER_CHANGE',
        proveedor_id: row.proveedor_id,
        referencia_tipo: 'producto_proveedor',
        referencia_id: v_id,
      }, session.userId);
    } catch (e) {
      console.error('[precios] Error generando batch por cambio de preferido:', e);
    }
  } else {
    db.update(schema.producto_proveedor).set({
      ...(v_costo_centavos   !== undefined && { costo_centavos:   v_costo_centavos }),
      ...(v_codigo_proveedor !== undefined && { codigo_proveedor: v_codigo_proveedor }),
      ...(v_preferido        !== undefined && { preferido:        v_preferido }),
      updated_at: now,
    }).where(eq(schema.producto_proveedor.id, v_id)).run();
  }
  return { id: v_id };
}

export function registerProductoProveedorHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('proveedor.gestionar');
  // Existentes (usados por ProveedoresPanel en modo read-only)
  ipcMain.handle('compras.pp:listByProducto',  guard(async (_e, productoId) => productoProveedorListHandler(db, productoId)));
  ipcMain.handle('compras.pp:upsert',          guard(async (_e, p) => productoProveedorUpsertHandler(db, p)));
  ipcMain.handle('compras.pp:setPreferido',    guard(async (_e, id) => productoProveedorSetPreferidoHandler(db, id)));
  ipcMain.handle('compras.pp:remove',          guard(async (_e, id) => productoProveedorRemoveHandler(db, id)));
  ipcMain.handle('compras.pp:setOverrides',    guard(async (_e, id, patch) => productoProveedorSetOverridesHandler(db, id, patch)));
  // Nuevos — proveedor como dueño de la relación (ADR-036)
  ipcMain.handle('compras.pp:listByProveedor', guard(async (_e, proveedorId) => proveedorProductosListarHandler(db, proveedorId)));
  ipcMain.handle('compras.pp:asociar',         guard(async (_e, p) => proveedorProductosAsociarHandler(db, p)));
  ipcMain.handle('compras.pp:asociarLote',     guard(async (_e, p) => proveedorProductosAsociarLoteHandler(db, p)));
  ipcMain.handle('compras.pp:desasociar',      guard(async (_e, id) => proveedorProductosDesasociarHandler(db, id)));
  ipcMain.handle('compras.pp:actualizar',      guard(async (_e, id, p) => proveedorProductosActualizarHandler(db, id, p)));
}
