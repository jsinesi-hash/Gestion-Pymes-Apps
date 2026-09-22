import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, id, oneOf, optStr } from '@core/main';
import { getPrecioEnListaHandler } from './lista-precio-valor';

type Db = BetterSQLite3Database<typeof schema>;

export type Tipo = 'equivalente' | 'reemplazo';

// Factor de la presentación default (unidad por defecto). 1.0 si no hay presentación default.
// Helper local para no acoplar este servicio a otras features/ramas.
function factorPresentacionDefault(db: Db, productoId: string): number {
  const pp = db.select({ factor: schema.producto_presentacion.factor_a_stock })
    .from(schema.producto_presentacion)
    .where(and(
      eq(schema.producto_presentacion.producto_id, productoId),
      eq(schema.producto_presentacion.es_default, true),
      eq(schema.producto_presentacion.activo, true),
    ))
    .get();
  return pp?.factor ?? 1.0;
}

export type EquivalenciaItem = {
  id: string;
  producto_id: string;
  sku: string;
  nombre_corto: string;
  marca_nombre: string | null;
  precio_final_centavos: number;
  precio_origen: 'promocion' | 'vigente' | 'fallback';
  stock_fisico: number;
  discontinuado: boolean;
  nota: string | null;
};

function enriquecer(db: Db, filas: { id: string; otroId: string; nota: string | null }[], clienteId?: string): EquivalenciaItem[] {
  if (filas.length === 0) return [];
  const ids = filas.map(f => f.otroId);
  const prod = db.select({
    id: schema.producto.id,
    sku: schema.producto.sku,
    nombre_corto: schema.producto.nombre_corto,
    precio_venta_lista: schema.producto.precio_venta_lista,
    activo: schema.producto.activo,
    discontinuado: schema.producto.discontinuado,
    marca_nombre: schema.marca.nombre,
    stock_fisico: schema.existencias.stock_fisico,
  }).from(schema.producto)
    .leftJoin(schema.marca, eq(schema.marca.id, schema.producto.marca_id))
    .leftJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(inArray(schema.producto.id, ids))
    .all();
  const porId = new Map(prod.map(p => [p.id, p]));

  const predeterminada = db.select({ id: schema.lista_precio.id })
    .from(schema.lista_precio)
    .where(eq(schema.lista_precio.predeterminada, true))
    .get();

  const out: EquivalenciaItem[] = [];
  for (const f of filas) {
    const p = porId.get(f.otroId);
    if (!p || !p.activo) continue;
    const factor = factorPresentacionDefault(db, f.otroId);
    let base: number;
    let origen: 'promocion' | 'vigente' | 'fallback';
    if (predeterminada) {
      const r = getPrecioEnListaHandler(db, {
        productoId: f.otroId, listaId: predeterminada.id,
        ...(clienteId !== undefined ? { clienteId } : {}),
      });
      base = r.precio_centavos; origen = r.origen;
    } else {
      base = Math.round((p.precio_venta_lista ?? 0) * 100); origen = 'fallback';
    }
    out.push({
      id: f.id,
      producto_id: p.id,
      sku: p.sku,
      nombre_corto: p.nombre_corto,
      marca_nombre: p.marca_nombre ?? null,
      precio_final_centavos: Math.round(base * factor),
      precio_origen: origen,
      stock_fisico: p.stock_fisico ?? 0,
      discontinuado: p.discontinuado,
      nota: f.nota,
    });
  }
  return out;
}

export type EquivalenciaListResult = {
  equivalentes: EquivalenciaItem[];
  reemplazado_por: EquivalenciaItem[];
  reemplaza_a: EquivalenciaItem[];
};

export function equivalenciaListHandler(
  db: Db, params: { producto_id: string; clienteId?: string },
): EquivalenciaListResult {
  const pid = params.producto_id;

  const eqRows = db.select().from(schema.producto_equivalencia)
    .where(and(isNull(schema.producto_equivalencia.deleted_at),
      eq(schema.producto_equivalencia.tipo, 'equivalente' as Tipo),
      or(eq(schema.producto_equivalencia.producto_id, pid), eq(schema.producto_equivalencia.producto_relacionado_id, pid))))
    .all();
  const equivalentes = enriquecer(db, eqRows.map(r => ({
    id: r.id, otroId: r.producto_id === pid ? r.producto_relacionado_id : r.producto_id, nota: r.nota,
  })), params.clienteId);

  const repRows = db.select().from(schema.producto_equivalencia)
    .where(and(isNull(schema.producto_equivalencia.deleted_at),
      eq(schema.producto_equivalencia.tipo, 'reemplazo' as Tipo),
      eq(schema.producto_equivalencia.producto_id, pid)))
    .all();
  const reemplazado_por = enriquecer(db, repRows.map(r => ({ id: r.id, otroId: r.producto_relacionado_id, nota: r.nota })), params.clienteId);

  const invRows = db.select().from(schema.producto_equivalencia)
    .where(and(isNull(schema.producto_equivalencia.deleted_at),
      eq(schema.producto_equivalencia.tipo, 'reemplazo' as Tipo),
      eq(schema.producto_equivalencia.producto_relacionado_id, pid)))
    .all();
  const reemplaza_a = enriquecer(db, invRows.map(r => ({ id: r.id, otroId: r.producto_id, nota: r.nota })), params.clienteId);

  return { equivalentes, reemplazado_por, reemplaza_a };
}

const TIPOS_VALIDOS = ['equivalente', 'reemplazo'] as const;

export function equivalenciaAddHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_producto_id = id(p['producto_id'], 'producto_id');
  const v_producto_relacionado_id = id(p['producto_relacionado_id'], 'producto_relacionado_id');
  const v_tipo = oneOf(p['tipo'], 'tipo', TIPOS_VALIDOS);
  const v_nota = optStr(p['nota'], 'nota', 1000);

  if (v_producto_id === v_producto_relacionado_id) throw new Error('AUTO_RELACION');

  const dupBase = and(isNull(schema.producto_equivalencia.deleted_at), eq(schema.producto_equivalencia.tipo, v_tipo));
  const dupConds = [
    and(eq(schema.producto_equivalencia.producto_id, v_producto_id), eq(schema.producto_equivalencia.producto_relacionado_id, v_producto_relacionado_id)),
  ];
  if (v_tipo === 'equivalente') {
    dupConds.push(and(eq(schema.producto_equivalencia.producto_id, v_producto_relacionado_id), eq(schema.producto_equivalencia.producto_relacionado_id, v_producto_id)));
  }
  const existe = db.select({ id: schema.producto_equivalencia.id }).from(schema.producto_equivalencia)
    .where(and(dupBase, or(...dupConds)))
    .get();
  if (existe) throw new Error('RELACION_DUPLICADA');

  const now = new Date();
  const nuevoId = generateId();
  db.insert(schema.producto_equivalencia).values({
    id: nuevoId,
    producto_id: v_producto_id,
    producto_relacionado_id: v_producto_relacionado_id,
    tipo: v_tipo,
    nota: v_nota ?? null,
    deleted_at: null,
    usuario_creacion_id: session.userId,
    fecha_creacion: now,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();
  return db.select().from(schema.producto_equivalencia).where(eq(schema.producto_equivalencia.id, nuevoId)).get()!;
}

export function equivalenciaRemoveHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');

  db.update(schema.producto_equivalencia)
    .set({ deleted_at: new Date(), updated_at: new Date(), sync_state: 'pending' })
    .where(eq(schema.producto_equivalencia.id, v_id))
    .run();
  return { ok: true as const };
}

export function registerEquivalenciaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('equivalencia:list',   async (_e, p) => equivalenciaListHandler(db, p));
  ipcMain.handle('equivalencia:add',    async (_e, p) => equivalenciaAddHandler(db, p));
  ipcMain.handle('equivalencia:remove', async (_e, p) => equivalenciaRemoveHandler(db, p));
}
