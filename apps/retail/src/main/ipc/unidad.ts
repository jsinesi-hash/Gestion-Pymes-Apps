import { eq, or, and, count } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { str, id as vId } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

export function unidadListHandler(db: Db) {
  return db.select().from(schema.unidad).where(eq(schema.unidad.activo, true)).all();
}

// Filas para exportación (ADR-EXP): unidades activas con su abreviatura.
export function unidadQueryAll(db: Db) {
  return db.select({
    nombre: schema.unidad.nombre,
    abreviatura: schema.unidad.abreviatura,
    activo: schema.unidad.activo,
  }).from(schema.unidad).where(eq(schema.unidad.activo, true)).orderBy(schema.unidad.nombre).all();
}

export function unidadListAllHandler(db: Db) {
  return db.select().from(schema.unidad).all();
}

export function unidadCreateHandler(
  db: Db,
  payload: unknown,
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const nombre = str(p['nombre'], 'nombre', { max: 60 });
  const abreviatura = str(p['abreviatura'], 'abreviatura', { max: 10 });
  const now = new Date();
  const id = generateId();
  db.insert(schema.unidad).values({
    id,
    nombre,
    abreviatura,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return db.select().from(schema.unidad).where(eq(schema.unidad.id, id)).get()!;
}

export function unidadUpdateHandler(
  db: Db,
  payload: unknown,
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const targetId = vId(p['id'], 'id');
  const existing = db.select().from(schema.unidad).where(eq(schema.unidad.id, targetId)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  };
  if (p['nombre'] !== undefined) updates.nombre = str(p['nombre'], 'nombre', { max: 60 });
  if (p['abreviatura'] !== undefined) updates.abreviatura = str(p['abreviatura'], 'abreviatura', { max: 10 });
  db.update(schema.unidad).set(updates).where(eq(schema.unidad.id, targetId)).run();
  return db.select().from(schema.unidad).where(eq(schema.unidad.id, targetId)).get()!;
}

export function unidadDesactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.unidad).where(eq(schema.unidad.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const abr = existing.abreviatura;
  const [{ value: n }] = db
    .select({ value: count() })
    .from(schema.producto)
    .where(
      and(
        eq(schema.producto.activo, true),
        or(
          eq(schema.producto.unidad_venta, abr),
          eq(schema.producto.unidad_compra, abr),
        ),
      ),
    )
    .all();
  if (n > 0) throw new Error(`TIENE_PRODUCTOS:${n}`);
  const now = new Date();
  db.update(schema.unidad).set({
    activo: false,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  }).where(eq(schema.unidad.id, payload.id)).run();
}

export function unidadReactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.unidad).where(eq(schema.unidad.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.unidad).set({
    activo: true,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  }).where(eq(schema.unidad.id, payload.id)).run();
}

export function registerUnidadHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('unidad:list',       async () => unidadListHandler(db));
  ipcMain.handle('unidad:list-all',   async () => unidadListAllHandler(db));
  ipcMain.handle('unidad:create',     async (_e, p) => unidadCreateHandler(db, p));
  ipcMain.handle('unidad:update',     async (_e, p) => unidadUpdateHandler(db, p));
  ipcMain.handle('unidad:desactivar', async (_e, p) => unidadDesactivarHandler(db, p));
  ipcMain.handle('unidad:reactivar',  async (_e, p) => unidadReactivarHandler(db, p));
}
