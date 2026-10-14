import { and, asc, eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getSession, getOriginId, requirePermission, str, num, int, arr, id as vId } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export function grupoModificadorListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.grupo_modificador).all();
}

export function grupoModificadorGetHandler(db: Db, payload: { id: string }) {
  requireSession();
  const grupo = db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.id, payload.id)).get();
  if (!grupo) return null;
  const opciones = db.select().from(schema.grupo_modificador_opcion)
    .where(and(eq(schema.grupo_modificador_opcion.grupo_modificador_id, grupo.id), eq(schema.grupo_modificador_opcion.activo, true)))
    .orderBy(asc(schema.grupo_modificador_opcion.orden)).all();
  return { ...grupo, opciones };
}

export function grupoModificadorCreateHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_nombre = str(p['nombre'], 'nombre', { max: 60 });

  const id = generateId();
  db.insert(schema.grupo_modificador).values({
    id, nombre: v_nombre,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: new Date(),
  }).run();

  return db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.id, id)).get()!;
}

export function grupoModificadorOpcionSetHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_grupo_id = vId(p['grupo_modificador_id'], 'grupo_modificador_id');
  const v_opciones = arr(p['opciones'], 'opciones', (x) => {
    const o = x as Record<string, unknown>;
    return {
      articulo_id: vId(o['articulo_id'], 'opciones.articulo_id'),
      nombre: str(o['nombre'], 'opciones.nombre', { max: 60 }),
      recargo_centavos: o['recargo_centavos'] == null ? 0 : int(o['recargo_centavos'], 'opciones.recargo_centavos', { min: 0 }),
      cantidad: o['cantidad'] == null ? 0 : num(o['cantidad'], 'opciones.cantidad', { min: 0 }),
      orden: o['orden'] == null ? 0 : int(o['orden'], 'opciones.orden', { min: 0 }),
    };
  });

  const grupo = db.select().from(schema.grupo_modificador).where(eq(schema.grupo_modificador.id, v_grupo_id)).get();
  if (!grupo) throw new Error('NOT_FOUND');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  // ADR-102: las opciones se referencian desde venta_linea_modificador, así que nunca se borran:
  // upsert por artículo (conserva el id) y baja lógica de las que ya no vienen.
  db.transaction((tx) => {
    const existentes = tx.select().from(schema.grupo_modificador_opcion)
      .where(eq(schema.grupo_modificador_opcion.grupo_modificador_id, v_grupo_id)).all();
    const porArticulo = new Map(existentes.map((e) => [e.articulo_id, e]));
    const vigentes = new Set<string>();
    for (const op of v_opciones) {
      if (vigentes.has(op.articulo_id)) throw new Error('OPCION_DUPLICADA');
      vigentes.add(op.articulo_id);
      const previa = porArticulo.get(op.articulo_id);
      if (previa) {
        tx.update(schema.grupo_modificador_opcion)
          .set({ ...op, activo: true, ...sync, version: previa.version + 1 })
          .where(eq(schema.grupo_modificador_opcion.id, previa.id)).run();
      } else {
        tx.insert(schema.grupo_modificador_opcion).values({
          id: generateId(), grupo_modificador_id: v_grupo_id, ...op, activo: true, ...sync,
        }).run();
      }
    }
    for (const e of existentes) {
      if (e.activo && !vigentes.has(e.articulo_id)) {
        tx.update(schema.grupo_modificador_opcion)
          .set({ activo: false, ...sync, version: e.version + 1 })
          .where(eq(schema.grupo_modificador_opcion.id, e.id)).run();
      }
    }
  });

  return grupoModificadorGetHandler(db, { id: v_grupo_id });
}

export function registerGrupoModificadorHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('producto_venta.gestionar');
  ipcMain.handle('grupo-modificador:list', async () => grupoModificadorListHandler(db));
  ipcMain.handle('grupo-modificador:get', async (_e, p) => grupoModificadorGetHandler(db, p));
  ipcMain.handle('grupo-modificador:create', guard(async (_e, p) => grupoModificadorCreateHandler(db, p)));
  ipcMain.handle('grupo-modificador:opcion-set', guard(async (_e, p) => grupoModificadorOpcionSetHandler(db, p)));
}
