import { eq, and } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { id, optId, num, int, oneOf } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

type ReglaTipo = 'producto' | 'marca' | 'rubro' | 'proveedor' | 'lista';
type RedondeoModo = 'ninguno' | 'terminacion_90' | 'terminacion_99' | 'multiplo';

const REGLA_TIPOS = ['producto', 'marca', 'rubro', 'proveedor', 'lista'] as const;
const REDONDEO_MODOS = ['ninguno', 'terminacion_90', 'terminacion_99', 'multiplo'] as const;

// Especificidad para ordenar la lista igual que shared/resolverRegla (menor gana).
const RANGO: Record<ReglaTipo, number> = { producto: 0, marca: 1, rubro: 2, proveedor: 3, lista: 4 };

function requireSupervisor() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('config.fiscal')) throw new Error('FORBIDDEN');
  return session;
}

export function reglaPrecioListHandler(db: Db, listaId: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const rows = db.select().from(schema.regla_precio)
    .where(and(
      eq(schema.regla_precio.lista_precio_id, listaId),
      eq(schema.regla_precio.activo, true),
    ))
    .all();
  return rows.sort((a, b) => {
    const ra = RANGO[a.tipo as ReglaTipo];
    const rb = RANGO[b.tipo as ReglaTipo];
    if (ra !== rb) return ra - rb;
    return a.prioridad - b.prioridad;
  });
}

export function reglaPrecioUpsertHandler(db: Db, payload: unknown) {
  const session = requireSupervisor();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = optId(p['id'], 'id');
  const v_lista_precio_id = id(p['lista_precio_id'], 'lista_precio_id');
  const v_tipo = oneOf(p['tipo'], 'tipo', REGLA_TIPOS);
  const v_objetivo_id = optId(p['objetivo_id'], 'objetivo_id');
  const v_margen_pct = num(p['margen_pct'], 'margen_pct');
  const v_margen_min_pct = p['margen_min_pct'] == null ? null : num(p['margen_min_pct'], 'margen_min_pct');
  const v_margen_max_pct = p['margen_max_pct'] == null ? null : num(p['margen_max_pct'], 'margen_max_pct');
  const v_redondeo_modo = p['redondeo_modo'] == null ? undefined : oneOf(p['redondeo_modo'], 'redondeo_modo', REDONDEO_MODOS);
  const v_redondeo_valor = p['redondeo_valor'] == null ? null : num(p['redondeo_valor'], 'redondeo_valor');
  const v_prioridad = p['prioridad'] == null ? undefined : int(p['prioridad'], 'prioridad', { min: 0 });

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  const set = {
    lista_precio_id: v_lista_precio_id,
    tipo: v_tipo,
    objetivo_id: v_tipo === 'lista' ? null : (v_objetivo_id ?? null),
    margen_pct: v_margen_pct,
    margen_min_pct: v_margen_min_pct,
    margen_max_pct: v_margen_max_pct,
    redondeo_modo: v_redondeo_modo ?? 'ninguno',
    redondeo_valor: v_redondeo_valor,
    prioridad: v_prioridad ?? 100,
  };

  if (v_id) {
    db.update(schema.regla_precio).set({
      ...set,
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
      ...sync,
    }).where(eq(schema.regla_precio.id, v_id)).run();
    return { id: v_id };
  }

  const nuevoId = generateId();
  db.insert(schema.regla_precio).values({
    id: nuevoId,
    ...set,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    ...sync,
  }).run();
  return { id: nuevoId };
}

export function reglaPrecioRemoveHandler(db: Db, idArg: unknown) {
  const session = requireSupervisor();
  const v_id = id(idArg, 'id');
  const now = new Date();
  db.update(schema.regla_precio).set({
    activo: false,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
    updated_at: now,
  }).where(eq(schema.regla_precio.id, v_id)).run();
  return { id: v_id };
}

export function registerReglaPrecioHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('reglaPrecio:listByLista', async (_e, listaId) => reglaPrecioListHandler(db, listaId));
  ipcMain.handle('reglaPrecio:upsert',      async (_e, p)       => reglaPrecioUpsertHandler(db, p));
  ipcMain.handle('reglaPrecio:remove',      async (_e, idArg)   => reglaPrecioRemoveHandler(db, idArg));
}
