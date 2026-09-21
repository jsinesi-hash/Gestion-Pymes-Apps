import { eq, and, ne } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { str, num, oneOf } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

function requireSupervisor() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('config.fiscal')) throw new Error('FORBIDDEN');
  return session;
}

type ModoCalculo = 'margen_costo' | 'pct_sobre_lista' | 'manual';

export type CreateListaPrecioPayload = {
  nombre: string;
  descripcion?: string;
  tipo?: 'general' | 'especial';
  ajuste_porcentual: number;
  modo_calculo?: ModoCalculo;
  predeterminada?: boolean;
  vigencia_desde?: Date;
  vigencia_hasta?: Date;
};

export type UpdateListaPrecioPayload = {
  id: string;
  nombre?: string;
  descripcion?: string;
  tipo?: 'general' | 'especial';
  ajuste_porcentual?: number;
  modo_calculo?: ModoCalculo;
  predeterminada?: boolean;
  vigencia_desde?: Date | null;
  vigencia_hasta?: Date | null;
};

export function listaPrecioListHandler(db: Db) {
  return db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.activo, true))
    .all();
}

export function listaPrecioGetHandler(db: Db, payload: { id: string }) {
  return db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, payload.id))
    .get() ?? null;
}

export function listaPrecioCreateHandler(db: Db, rawPayload: unknown) {
  const session = requireSupervisor();

  // ADR-082 (SEC-2): valida forma/tipo del payload antes de tocar la BD.
  const pv = (rawPayload ?? {}) as Record<string, unknown>;
  str(pv['nombre'], 'nombre', { max: 120 });
  num(pv['ajuste_porcentual'], 'ajuste_porcentual');
  if (pv['tipo'] != null) oneOf(pv['tipo'], 'tipo', ['general', 'especial'] as const);
  const payload = rawPayload as CreateListaPrecioPayload;

  const now = new Date();
  const id = generateId();

  return db.transaction((tx) => {
    if (payload.predeterminada) {
      tx.update(schema.lista_precio)
        .set({ predeterminada: false, updated_at: now, sync_state: 'pending' })
        .where(eq(schema.lista_precio.predeterminada, true))
        .run();
    }

    tx.insert(schema.lista_precio).values({
      id,
      nombre: payload.nombre,
      descripcion: payload.descripcion ?? null,
      tipo: payload.tipo ?? 'general',
      ajuste_porcentual: payload.ajuste_porcentual,
      modo_calculo: payload.modo_calculo ?? 'pct_sobre_lista',
      predeterminada: payload.predeterminada ?? false,
      vigencia_desde: payload.vigencia_desde ?? null,
      vigencia_hasta: payload.vigencia_hasta ?? null,
      activo: true,
      usuario_creacion_id: session.userId,
      fecha_creacion: now,
      version: 1,
      origin_id: getOriginId(),
      sync_state: 'pending',
      updated_at: now,
    }).run();

    // Auto-seed lista_precio_valor for all active products
    const productosActivos = tx.select({
      id: schema.producto.id,
      precio_venta_lista: schema.producto.precio_venta_lista,
    }).from(schema.producto)
      .where(eq(schema.producto.activo, true))
      .all();

    const ajuste = payload.ajuste_porcentual ?? 0;
    for (const prod of productosActivos) {
      const baseCs = Math.round(prod.precio_venta_lista * 100);
      tx.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: id,
        producto_id: prod.id,
        precio_centavos: Math.round(baseCs * (1 + ajuste / 100)),
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'manual',
        recalculo_masivo_id: null,
        usuario_id: session.userId,
        version: 1,
        origin_id: getOriginId(),
        sync_state: 'pending',
        updated_at: now,
      }).run();
    }

    return tx.select().from(schema.lista_precio)
      .where(eq(schema.lista_precio.id, id))
      .get()!;
  });
}

export function listaPrecioUpdateHandler(db: Db, payload: UpdateListaPrecioPayload) {
  const session = requireSupervisor();
  const existing = db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, payload.id))
    .get();
  if (!existing) throw new Error('NOT_FOUND');

  if (payload.predeterminada === false && existing.predeterminada) {
    const otherDefaults = db.select().from(schema.lista_precio)
      .where(and(
        eq(schema.lista_precio.predeterminada, true),
        ne(schema.lista_precio.id, payload.id),
      ))
      .all();
    if (otherDefaults.length === 0) throw new Error('CANNOT_UNSET_ONLY_DEFAULT');
  }

  const now = new Date();

  return db.transaction((tx) => {
    if (payload.predeterminada === true && !existing.predeterminada) {
      tx.update(schema.lista_precio)
        .set({ predeterminada: false, updated_at: now, sync_state: 'pending' })
        .where(and(
          eq(schema.lista_precio.predeterminada, true),
          ne(schema.lista_precio.id, payload.id),
        ))
        .run();
    }

    const updates: Record<string, unknown> = {
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
    };
    if (payload.nombre !== undefined) updates.nombre = payload.nombre;
    if (payload.descripcion !== undefined) updates.descripcion = payload.descripcion;
    if (payload.tipo !== undefined) updates.tipo = payload.tipo;
    if (payload.ajuste_porcentual !== undefined) updates.ajuste_porcentual = payload.ajuste_porcentual;
    if (payload.modo_calculo !== undefined) updates.modo_calculo = payload.modo_calculo;
    if (payload.predeterminada !== undefined) updates.predeterminada = payload.predeterminada;
    if (payload.vigencia_desde !== undefined) updates.vigencia_desde = payload.vigencia_desde;
    if (payload.vigencia_hasta !== undefined) updates.vigencia_hasta = payload.vigencia_hasta;

    tx.update(schema.lista_precio).set(updates)
      .where(eq(schema.lista_precio.id, payload.id))
      .run();
    return tx.select().from(schema.lista_precio)
      .where(eq(schema.lista_precio.id, payload.id))
      .get()!;
  });
}

export function listaPrecioDeactivateHandler(db: Db, payload: { id: string }) {
  const session = requireSupervisor();
  const existing = db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, payload.id))
    .get();
  if (!existing) throw new Error('NOT_FOUND');

  // ADR-034: lista_precio_detalle is deprecated; historical rows in lista_precio_valor
  // stay as history — do not block deactivation on their presence.
  const now = new Date();
  db.update(schema.lista_precio)
    .set({ activo: false, version: existing.version + 1, updated_at: now, sync_state: 'pending', usuario_modificacion_id: session.userId, fecha_actualizacion: now })
    .where(eq(schema.lista_precio.id, payload.id))
    .run();
  return db.select().from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, payload.id))
    .get()!;
}

export function registerListaPrecioHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('listaPrecio:list',       async ()       => listaPrecioListHandler(db));
  ipcMain.handle('listaPrecio:get',        async (_e, p)  => listaPrecioGetHandler(db, p));
  ipcMain.handle('listaPrecio:create',     async (_e, p)  => listaPrecioCreateHandler(db, p));
  ipcMain.handle('listaPrecio:update',     async (_e, p)  => listaPrecioUpdateHandler(db, p));
  ipcMain.handle('listaPrecio:deactivate', async (_e, p)  => listaPrecioDeactivateHandler(db, p));
}
