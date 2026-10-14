import { and, asc, eq, isNull } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import {
  getSession, getOriginId, requirePermission, listaDeCliente,
  str, optStr, num, int, bool, id as vId,
} from '@core/main';
import * as schema from '../db/schema';
import { precioParaLista } from '../domain/precio-lista';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

/**
 * Precios efectivos de los productos para la lista del cliente (ADR-104). Devuelve el precio base
 * tal cual si no hay cliente, el cliente no tiene lista o la lista está inactiva. Sin N+1 por
 * producto: una consulta de los absolutos vigentes de la lista.
 */
export function resolverPreciosCliente(
  db: Db, clienteId: string | undefined, base: ReadonlyMap<string, number>,
): Map<string, number> {
  const listaId = listaDeCliente(db, clienteId);
  const lista = listaId
    ? db.select().from(schema.lista_precio).where(eq(schema.lista_precio.id, listaId)).get()
    : undefined;
  if (!lista?.activo) return new Map(base);
  const absolutos = new Map(
    db.select().from(schema.producto_venta_precio)
      .where(and(eq(schema.producto_venta_precio.lista_precio_id, lista.id), isNull(schema.producto_venta_precio.fecha_hasta)))
      .all().map((f) => [f.producto_venta_id, f.precio_centavos] as const),
  );
  return new Map([...base].map(([pid, precio]) => [pid, precioParaLista(precio, absolutos.get(pid) ?? null, lista.ajuste_porcentual)]));
}

export function listaPrecioListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.lista_precio).orderBy(asc(schema.lista_precio.nombre)).all();
}

export function listaPrecioCreateHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const nombre = str(p['nombre'], 'nombre', { max: 60 });
  const descripcion = optStr(p['descripcion'], 'descripcion', 200);
  const ajuste = p['ajuste_porcentual'] == null ? 0 : num(p['ajuste_porcentual'], 'ajuste_porcentual', { min: -100, max: 1000 });
  const now = new Date();
  const id = generateId();
  db.insert(schema.lista_precio).values({
    id, nombre, descripcion: descripcion ?? null, tipo: 'especial', ajuste_porcentual: ajuste,
    predeterminada: false, activo: true, usuario_creacion_id: session.userId, fecha_creacion: now,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return db.select().from(schema.lista_precio).where(eq(schema.lista_precio.id, id)).get()!;
}

export function listaPrecioUpdateHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const id = vId(p['id'], 'id');
  const actual = db.select().from(schema.lista_precio).where(eq(schema.lista_precio.id, id)).get();
  if (!actual) throw new Error('NOT_FOUND');
  const now = new Date();
  db.update(schema.lista_precio).set({
    ...(p['nombre'] !== undefined && { nombre: str(p['nombre'], 'nombre', { max: 60 }) }),
    ...(p['descripcion'] !== undefined && { descripcion: optStr(p['descripcion'], 'descripcion', 200) ?? null }),
    ...(p['ajuste_porcentual'] !== undefined && { ajuste_porcentual: num(p['ajuste_porcentual'], 'ajuste_porcentual', { min: -100, max: 1000 }) }),
    ...(p['activo'] !== undefined && { activo: bool(p['activo'], 'activo') }),
    usuario_modificacion_id: session.userId, fecha_actualizacion: now,
    version: actual.version + 1, sync_state: 'pending', updated_at: now,
  }).where(eq(schema.lista_precio.id, id)).run();
  return db.select().from(schema.lista_precio).where(eq(schema.lista_precio.id, id)).get()!;
}

/** Precios absolutos vigentes de una lista (los productos sin fila usan el ajuste % de la lista). */
export function listaPrecioPreciosHandler(db: Db, payload: { lista_precio_id: string }) {
  requireSession();
  return db.select({
    producto_venta_id: schema.producto_venta_precio.producto_venta_id,
    precio_centavos: schema.producto_venta_precio.precio_centavos,
  }).from(schema.producto_venta_precio)
    .where(and(eq(schema.producto_venta_precio.lista_precio_id, payload.lista_precio_id), isNull(schema.producto_venta_precio.fecha_hasta)))
    .all();
}

/** SCD tipo 2: cierra el vigente y abre uno nuevo. `precio_centavos: null` quita el absoluto. */
export function listaPrecioPrecioSetHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const lista_precio_id = vId(p['lista_precio_id'], 'lista_precio_id');
  const producto_venta_id = vId(p['producto_venta_id'], 'producto_venta_id');
  const precio = p['precio_centavos'] == null ? null : int(p['precio_centavos'], 'precio_centavos', { min: 0 });

  if (!db.select({ id: schema.lista_precio.id }).from(schema.lista_precio).where(eq(schema.lista_precio.id, lista_precio_id)).get()) throw new Error('NOT_FOUND');
  if (!db.select({ id: schema.producto_venta.id }).from(schema.producto_venta).where(eq(schema.producto_venta.id, producto_venta_id)).get()) throw new Error('NOT_FOUND');

  const now = new Date();
  db.transaction((tx) => {
    const vigente = tx.select().from(schema.producto_venta_precio)
      .where(and(
        eq(schema.producto_venta_precio.lista_precio_id, lista_precio_id),
        eq(schema.producto_venta_precio.producto_venta_id, producto_venta_id),
        isNull(schema.producto_venta_precio.fecha_hasta),
      )).get();
    if (vigente) {
      tx.update(schema.producto_venta_precio).set({
        fecha_hasta: now, version: vigente.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.producto_venta_precio.id, vigente.id)).run();
    }
    if (precio !== null) {
      tx.insert(schema.producto_venta_precio).values({
        id: generateId(), lista_precio_id, producto_venta_id, precio_centavos: precio,
        fecha_desde: now, fecha_hasta: null, usuario_id: session.userId,
        version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
      }).run();
    }
  });
  return { ok: true as const };
}

export function registerListaPrecioHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('lista_precio.gestionar');
  ipcMain.handle('lista-precio:list', async () => listaPrecioListHandler(db));
  ipcMain.handle('lista-precio:precios', async (_e, p) => listaPrecioPreciosHandler(db, p));
  ipcMain.handle('lista-precio:create', guard(async (_e, p) => listaPrecioCreateHandler(db, p)));
  ipcMain.handle('lista-precio:update', guard(async (_e, p) => listaPrecioUpdateHandler(db, p)));
  ipcMain.handle('lista-precio:precio-set', guard(async (_e, p) => listaPrecioPrecioSetHandler(db, p)));
}
