import { eq, and, count } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, str, optStr, optId, bool, id as vId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export type CreateCategoriaPayload = {
  nombre: string;
  descripcion?: string;
  categoria_padre_id?: string;
};

export type UpdateCategoriaPayload = {
  id: string;
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
};

export function categoriaListHandler(db: Db) {
  return db.select().from(schema.categoria).where(eq(schema.categoria.activo, true)).all();
}

export function categoriaCreateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const nombre = str(p['nombre'], 'nombre', { max: 120 });
  const descripcion = optStr(p['descripcion'], 'descripcion', 500);
  const categoria_padre_id = optId(p['categoria_padre_id'], 'categoria_padre_id');
  const now = new Date();
  const id = generateId();
  db.insert(schema.categoria).values({
    id,
    nombre,
    descripcion: descripcion ?? null,
    categoria_padre_id: categoria_padre_id ?? null,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return db.select().from(schema.categoria).where(eq(schema.categoria.id, id)).get()!;
}

export function categoriaUpdateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const targetId = vId(p['id'], 'id');
  const existing = db.select().from(schema.categoria).where(eq(schema.categoria.id, targetId)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  };
  if (p['nombre'] !== undefined) updates.nombre = str(p['nombre'], 'nombre', { max: 120 });
  if (p['descripcion'] !== undefined) updates.descripcion = optStr(p['descripcion'], 'descripcion', 500) ?? null;
  if (p['activo'] !== undefined) updates.activo = bool(p['activo'], 'activo');
  db.update(schema.categoria).set(updates).where(eq(schema.categoria.id, targetId)).run();
  return db.select().from(schema.categoria).where(eq(schema.categoria.id, targetId)).get()!;
}

export function categoriaListAllHandler(db: Db) {
  return db.select().from(schema.categoria).all();
}

// Filas para exportación (ADR-EXP): categorías activas con el NOMBRE de su categoría padre
// resuelto (el padre puede estar inactivo, por eso el mapa se arma sobre todas las filas).
export function categoriaQueryAll(db: Db) {
  const todas = db.select({
    id: schema.categoria.id,
    nombre: schema.categoria.nombre,
    descripcion: schema.categoria.descripcion,
    categoria_padre_id: schema.categoria.categoria_padre_id,
    activo: schema.categoria.activo,
  }).from(schema.categoria).all();
  const nombrePorId = new Map(todas.map(c => [c.id, c.nombre]));
  return todas
    .filter(c => c.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(c => ({
      nombre: c.nombre,
      descripcion: c.descripcion,
      categoria_padre: c.categoria_padre_id ? (nombrePorId.get(c.categoria_padre_id) ?? null) : null,
      activo: c.activo,
    }));
}

export function categoriaDesactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.categoria).where(eq(schema.categoria.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const [{ value: n }] = db.select({ value: count() }).from(schema.producto)
    .where(and(eq(schema.producto.categoria_id, payload.id), eq(schema.producto.activo, true)))
    .all();
  if (n > 0) throw new Error(`TIENE_PRODUCTOS:${n}`);
  const now = new Date();
  db.update(schema.categoria).set({
    activo: false, version: existing.version + 1, sync_state: 'pending',
    updated_at: now, usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  }).where(eq(schema.categoria.id, payload.id)).run();
}

export function categoriaReactivarHandler(db: Db, payload: { id: string }) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.categoria).where(eq(schema.categoria.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.categoria).set({
    activo: true, version: existing.version + 1, sync_state: 'pending',
    updated_at: now, usuario_modificacion_id: session.userId, fecha_actualizacion: now,
  }).where(eq(schema.categoria.id, payload.id)).run();
}

export function registerCategoriaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('categoria:list',       async () => categoriaListHandler(db));
  ipcMain.handle('categoria:list-all',   async () => categoriaListAllHandler(db));
  ipcMain.handle('categoria:create',     async (_e, p) => categoriaCreateHandler(db, p));
  ipcMain.handle('categoria:update',     async (_e, p) => categoriaUpdateHandler(db, p));
  ipcMain.handle('categoria:desactivar', async (_e, p) => categoriaDesactivarHandler(db, p));
  ipcMain.handle('categoria:reactivar',  async (_e, p) => categoriaReactivarHandler(db, p));
}
