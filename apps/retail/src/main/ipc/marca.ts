import { eq, and, count } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, str, optStr, id as vId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export function marcaListHandler(db: Db) {
  return db.select().from(schema.marca).where(eq(schema.marca.activo, true)).all();
}

// Filas para exportación (ADR-EXP): sólo las columnas relevantes, marcas activas.
export function marcaQueryAll(db: Db) {
  return db.select({
    nombre: schema.marca.nombre,
    descripcion: schema.marca.descripcion,
    activo: schema.marca.activo,
  }).from(schema.marca).where(eq(schema.marca.activo, true)).orderBy(schema.marca.nombre).all();
}

export function marcaListAllHandler(db: Db) {
  return db.select().from(schema.marca).all();
}

export function marcaCreateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const nombre = str(p['nombre'], 'nombre', { max: 120 });
  const descripcion = optStr(p['descripcion'], 'descripcion', 500);
  const now = new Date();
  const id = generateId();
  db.insert(schema.marca).values({
    id, nombre, descripcion: descripcion ?? null,
    activo: true, usuario_creacion_id: session.userId, fecha_creacion: now,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return db.select().from(schema.marca).where(eq(schema.marca.id, id)).get()!;
}

export function marcaUpdateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const targetId = vId(p['id'], 'id');
  const existing = db.select().from(schema.marca).where(eq(schema.marca.id, targetId)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: existing.version + 1, sync_state: 'pending', updated_at: now,
    usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  };
  if (p['nombre'] !== undefined) updates.nombre = str(p['nombre'], 'nombre', { max: 120 });
  if (p['descripcion'] !== undefined) updates.descripcion = optStr(p['descripcion'], 'descripcion', 500) ?? null;
  db.update(schema.marca).set(updates).where(eq(schema.marca.id, targetId)).run();
  return db.select().from(schema.marca).where(eq(schema.marca.id, targetId)).get()!;
}

export function marcaDesactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.marca).where(eq(schema.marca.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const [{ value: n }] = db.select({ value: count() }).from(schema.producto)
    .where(and(eq(schema.producto.marca_id, payload.id), eq(schema.producto.activo, true))).all();
  if (n > 0) throw new Error(`TIENE_PRODUCTOS:${n}`);
  const now = new Date();
  db.update(schema.marca).set({
    activo: false, version: existing.version + 1, sync_state: 'pending',
    updated_at: now, usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  }).where(eq(schema.marca.id, payload.id)).run();
}

export function marcaReactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.marca).where(eq(schema.marca.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.marca).set({
    activo: true, version: existing.version + 1, sync_state: 'pending',
    updated_at: now, usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  }).where(eq(schema.marca.id, payload.id)).run();
}

export function registerMarcaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('marca:list',       async () => marcaListHandler(db));
  ipcMain.handle('marca:list-all',   async () => marcaListAllHandler(db));
  ipcMain.handle('marca:create',     async (_e, p) => marcaCreateHandler(db, p));
  ipcMain.handle('marca:update',     async (_e, p) => marcaUpdateHandler(db, p));
  ipcMain.handle('marca:desactivar', async (_e, p) => marcaDesactivarHandler(db, p));
  ipcMain.handle('marca:reactivar',  async (_e, p) => marcaReactivarHandler(db, p));
}
