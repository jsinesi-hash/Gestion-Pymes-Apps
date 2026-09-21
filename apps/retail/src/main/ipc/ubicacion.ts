import { eq, sql, and, count } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, canonicalizarUbicacion } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { requirePermission } from '../auth/guard';
import { str, optStr, bool, id as vId } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

export type CreateUbicacionPayload = {
  sector: string;
  estante: string;
  posicion: string;
  descripcion?: string;
};

export type UpdateUbicacionPayload = {
  id: string;
  descripcion?: string;
  activo?: boolean;
};

export function ubicacionListHandler(db: Db) {
  return db.select().from(schema.ubicacion).where(eq(schema.ubicacion.activo, true)).all();
}

export function ubicacionQueryAll(db: Db) {
  return db.select({
    id:          schema.ubicacion.id,
    codigo:      schema.ubicacion.codigo,
    descripcion: schema.ubicacion.descripcion,
    sector:      schema.ubicacion.sector,
    estante:     schema.ubicacion.estante,
    posicion:    schema.ubicacion.posicion,
    cantidad_productos: sql<number>`(
      SELECT COUNT(*) FROM producto
      WHERE producto.ubicacion_id = ubicacion.id
        AND producto.activo = 1
    )`,
  })
    .from(schema.ubicacion)
    .where(eq(schema.ubicacion.activo, true))
    .all();
}

export function ubicacionListAllHandler(db: Db) {
  return db.select({
    id:          schema.ubicacion.id,
    codigo:      schema.ubicacion.codigo,
    descripcion: schema.ubicacion.descripcion,
    sector:      schema.ubicacion.sector,
    estante:     schema.ubicacion.estante,
    posicion:    schema.ubicacion.posicion,
    activo:      schema.ubicacion.activo,
    cantidad_productos: sql<number>`(
      SELECT COUNT(*) FROM producto
      WHERE producto.ubicacion_id = ubicacion.id
        AND producto.activo = 1
    )`,
  }).from(schema.ubicacion).all();
}

export function ubicacionGetHandler(db: Db, payload: { id: string }) {
  return db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, payload.id)).get() ?? null;
}

export function ubicacionCreateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const sector = str(p['sector'], 'sector', { max: 30 });
  const estante = str(p['estante'], 'estante', { max: 30 });
  const posicion = str(p['posicion'], 'posicion', { max: 30 });
  const descripcion = optStr(p['descripcion'], 'descripcion', 200);
  const canon = canonicalizarUbicacion(sector, estante, posicion);
  const existente = db.select({ id: schema.ubicacion.id })
    .from(schema.ubicacion)
    .where(eq(schema.ubicacion.codigo, canon.codigo)).get();
  if (existente) throw new Error(`YA_EXISTE:${canon.codigo}`);
  const now = new Date();
  const id = generateId();
  db.insert(schema.ubicacion).values({
    id,
    codigo: canon.codigo,
    sector: canon.sector,
    estante: canon.estante,
    posicion: canon.posicion,
    descripcion: descripcion ?? null,
    activo: true,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, id)).get()!;
}

export function ubicacionUpdateHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const p = (payload ?? {}) as Record<string, unknown>;
  const targetId = vId(p['id'], 'id');
  const existing = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, targetId)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const now = new Date();
  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: session.userId,
    fecha_actualizacion: now,
  };
  if (p['descripcion'] !== undefined) updates.descripcion = optStr(p['descripcion'], 'descripcion', 200) ?? null;
  if (p['activo'] !== undefined) updates.activo = bool(p['activo'], 'activo');
  db.update(schema.ubicacion).set(updates).where(eq(schema.ubicacion.id, targetId)).run();
  return db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, targetId)).get()!;
}

function contarProductosActivos(db: Db, ubicacionId: string): number {
  const [{ value }] = db.select({ value: count() })
    .from(schema.producto)
    .where(and(eq(schema.producto.ubicacion_id, ubicacionId), eq(schema.producto.activo, true)))
    .all();
  return value;
}

// Reasigna TODOS los productos de `fromId` a `toId` (o null), bumpeando sync/auditoría.
// Usar dentro de una transacción.
function reasignarProductos(
  tx: Db, fromId: string, toId: string | null, userId: string, now: Date,
): void {
  tx.update(schema.producto).set({
    ubicacion_id: toId,
    version: sql`${schema.producto.version} + 1`,
    sync_state: 'pending',
    updated_at: now,
    usuario_modificacion_id: userId,
    fecha_actualizacion: now,
  }).where(eq(schema.producto.ubicacion_id, fromId)).run();
}

export function ubicacionDeleteHandler(
  db: Db, payload: { id: string; reasignarA?: string | null },
) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const existing = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, payload.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const n = contarProductosActivos(db, payload.id);
  if (n > 0 && payload.reasignarA === undefined) throw new Error(`TIENE_PRODUCTOS:${n}`);
  if (payload.reasignarA) {
    const destino = db.select({ id: schema.ubicacion.id }).from(schema.ubicacion)
      .where(eq(schema.ubicacion.id, payload.reasignarA)).get();
    if (!destino) throw new Error('DESTINO_NOT_FOUND');
  }
  const now = new Date();
  db.transaction((tx) => {
    if (n > 0) reasignarProductos(tx as unknown as Db, payload.id, payload.reasignarA ?? null, session.userId, now);
    tx.update(schema.ubicacion).set({
      activo: false,
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
      usuario_modificacion_id: session.userId,
      fecha_actualizacion: now,
    }).where(eq(schema.ubicacion.id, payload.id)).run();
  });
}

export type DedupUbicacion = {
  id: string; codigo: string; sector: string; estante: string; posicion: string;
  cantidad_productos: number; fecha_creacion: Date;
};
export type DedupGrupo = {
  codigo: string;                 // canónica del grupo
  sobreviviente: DedupUbicacion;
  duplicados: DedupUbicacion[];
  productos_a_reasignar: number;
};

function elegirSobreviviente(miembros: DedupUbicacion[], codigoCanon: string): DedupUbicacion {
  const yaCanon = miembros.find(m => m.codigo === codigoCanon);
  if (yaCanon) return yaCanon;
  return [...miembros].sort((a, b) =>
    b.cantidad_productos - a.cantidad_productos
    || a.fecha_creacion.getTime() - b.fecha_creacion.getTime())[0];
}

export function ubicacionDedupPreviewHandler(db: Db): DedupGrupo[] {
  const activas = ubicacionListAllHandler(db).filter(u => u.activo);
  const filas = db.select({
    id: schema.ubicacion.id, sector: schema.ubicacion.sector, estante: schema.ubicacion.estante,
    posicion: schema.ubicacion.posicion, fecha_creacion: schema.ubicacion.fecha_creacion,
  }).from(schema.ubicacion).where(eq(schema.ubicacion.activo, true)).all();
  const fcById = new Map(filas.map(f => [f.id, f.fecha_creacion as Date]));

  const porCanon = new Map<string, DedupUbicacion[]>();
  for (const u of activas) {
    const canon = canonicalizarUbicacion(u.sector, u.estante, u.posicion).codigo;
    const item: DedupUbicacion = {
      id: u.id, codigo: u.codigo, sector: u.sector, estante: u.estante, posicion: u.posicion,
      cantidad_productos: u.cantidad_productos, fecha_creacion: fcById.get(u.id) ?? new Date(0),
    };
    const arr = porCanon.get(canon) ?? [];
    arr.push(item);
    porCanon.set(canon, arr);
  }

  const grupos: DedupGrupo[] = [];
  for (const [codigo, miembros] of porCanon) {
    if (miembros.length < 2) continue;
    const sobreviviente = elegirSobreviviente(miembros, codigo);
    const duplicados = miembros.filter(m => m.id !== sobreviviente.id);
    grupos.push({
      codigo, sobreviviente, duplicados,
      productos_a_reasignar: duplicados.reduce((s, d) => s + d.cantidad_productos, 0),
    });
  }
  return grupos;
}

export function ubicacionDedupAplicarHandler(db: Db): { grupos: number; duplicados_dados_de_baja: number } {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const grupos = ubicacionDedupPreviewHandler(db);
  const now = new Date();
  let bajas = 0;
  db.transaction((tx) => {
    for (const g of grupos) {
      const canon = canonicalizarUbicacion(g.sobreviviente.sector, g.sobreviviente.estante, g.sobreviviente.posicion);
      if (g.sobreviviente.codigo !== canon.codigo) {
        tx.update(schema.ubicacion).set({
          codigo: canon.codigo, sector: canon.sector, estante: canon.estante, posicion: canon.posicion,
          version: sql`${schema.ubicacion.version} + 1`, sync_state: 'pending', updated_at: now,
          usuario_modificacion_id: session.userId, fecha_actualizacion: now,
        }).where(eq(schema.ubicacion.id, g.sobreviviente.id)).run();
      }
      for (const d of g.duplicados) {
        reasignarProductos(tx as unknown as Db, d.id, g.sobreviviente.id, session.userId, now);
        tx.update(schema.ubicacion).set({
          activo: false, version: sql`${schema.ubicacion.version} + 1`, sync_state: 'pending',
          updated_at: now, usuario_modificacion_id: session.userId, fecha_actualizacion: now,
        }).where(eq(schema.ubicacion.id, d.id)).run();
        bajas++;
      }
    }
  });
  return { grupos: grupos.length, duplicados_dados_de_baja: bajas };
}

export function registerUbicacionHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('ubicacion:list',     async () => ubicacionListHandler(db));
  ipcMain.handle('ubicacion:list-all', async () => ubicacionListAllHandler(db));
  ipcMain.handle('ubicacion:get',      async (_e, p) => ubicacionGetHandler(db, p));
  ipcMain.handle('ubicacion:create',   async (_e, p) => ubicacionCreateHandler(db, p));
  ipcMain.handle('ubicacion:update',   async (_e, p) => ubicacionUpdateHandler(db, p));
  ipcMain.handle('ubicacion:delete',   async (_e, p) => ubicacionDeleteHandler(db, p));
  const guardSup = requirePermission('usuario.administrar');
  ipcMain.handle('ubicacion:dedup:preview', guardSup(async () => ubicacionDedupPreviewHandler(db)));
  ipcMain.handle('ubicacion:dedup:aplicar', guardSup(async () => ubicacionDedupAplicarHandler(db)));
}
