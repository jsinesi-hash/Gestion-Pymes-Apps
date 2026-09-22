import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession, getOriginId, str, optStr, optId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

function requireSessionOrThrow() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export function transportistaListHandler(db: Db, payload: { incluirInactivos?: boolean } = {}) {
  requireSessionOrThrow();
  const q = db.select().from(schema.transportista);
  if (payload.incluirInactivos) return q.all();
  return q.where(eq(schema.transportista.activo, true)).all();
}

// Filas para exportación (ADR-EXP): transportistas activos con contacto y domicilio.
export function transportistaQueryAll(db: Db) {
  return db.select({
    razon_social: schema.transportista.razon_social,
    persona_contacto: schema.transportista.persona_contacto,
    telefono: schema.transportista.telefono,
    email: schema.transportista.email,
    domicilio: schema.transportista.domicilio,
    activo: schema.transportista.activo,
  }).from(schema.transportista)
    .where(eq(schema.transportista.activo, true))
    .orderBy(schema.transportista.razon_social)
    .all();
}

export function transportistaGetHandler(db: Db, id: string) {
  requireSessionOrThrow();
  return db.select().from(schema.transportista).where(eq(schema.transportista.id, id)).get() ?? null;
}

export function transportistaUpsertHandler(db: Db, payload: unknown) {
  const session = requireSessionOrThrow();
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = optId(p['id'], 'id');
  const v_razon_social = str(p['razon_social'], 'razon_social', { max: 200 });
  const v_telefono = optStr(p['telefono'], 'telefono', 60);
  const v_email = optStr(p['email'], 'email', 200);
  const v_persona_contacto = optStr(p['persona_contacto'], 'persona_contacto', 200);
  const v_domicilio = optStr(p['domicilio'], 'domicilio', 300);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);

  if (v_id) {
    db.update(schema.transportista).set({
      razon_social:     v_razon_social,
      telefono:         v_telefono         ?? null,
      email:            v_email            ?? null,
      persona_contacto: v_persona_contacto ?? null,
      domicilio:        v_domicilio        ?? null,
      observaciones:    v_observaciones    ?? null,
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      ...sync,
    }).where(eq(schema.transportista.id, v_id)).run();
    return { id: v_id };
  }

  const id = generateId();
  db.insert(schema.transportista).values({
    id,
    razon_social:     v_razon_social,
    telefono:         v_telefono         ?? null,
    email:            v_email            ?? null,
    persona_contacto: v_persona_contacto ?? null,
    domicilio:        v_domicilio        ?? null,
    observaciones:    v_observaciones    ?? null,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    ...sync,
  }).run();
  return { id };
}

export function transportistaDeactivateHandler(db: Db, id: string) {
  const session = requireSessionOrThrow();
  const now = new Date();
  db.update(schema.transportista).set({
    activo: false,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    updated_at: now,
  }).where(eq(schema.transportista.id, id)).run();
  return { id };
}

export function registerTransportistaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('transportista:list',       async (_e, p) => transportistaListHandler(db, p ?? {}));
  ipcMain.handle('transportista:get',        async (_e, id) => transportistaGetHandler(db, id));
  ipcMain.handle('transportista:upsert',     async (_e, p) => transportistaUpsertHandler(db, p));
  ipcMain.handle('transportista:deactivate', async (_e, id) => transportistaDeactivateHandler(db, id));
}
