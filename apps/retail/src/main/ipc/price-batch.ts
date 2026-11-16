import { eq, inArray, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession, oneOf, id as vId } from '@core/main';
import { crearBatch, revalidarBatch, type CrearBatchParams } from '../precios/motor';
import {
  aprobarBatch, publicarBatch, revertirBatch, excluirFila, excluirErrores,
} from '../precios/publicacion';

type Db = BetterSQLite3Database<typeof schema>;

function requirePerm(codigo: string) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has(codigo)) throw new Error('FORBIDDEN');
  return session;
}

export function crearBatchHandler(db: Db, rawParams: unknown) {
  const session = requirePerm('precio.gestionar');
  // ADR-082 (SEC-2): valida forma/tipo antes de la lógica del motor.
  const p = (rawParams ?? {}) as Record<string, unknown>;
  vId(p['lista_precio_id'], 'lista_precio_id');
  oneOf(p['alcance'], 'alcance', ['catalogo', 'rubro', 'marca', 'proveedor'] as const);
  const params = rawParams as CrearBatchParams;
  return crearBatch(db, params, session.userId);
}

export function obtenerBatchHandler(db: Db, id: string) {
  requirePerm('precio.gestionar');
  const batchRow = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, id)).get();
  if (!batchRow) return null;
  const lista = db.select({ nombre: schema.lista_precio.nombre })
    .from(schema.lista_precio)
    .where(eq(schema.lista_precio.id, batchRow.lista_precio_id))
    .get();
  const batch = { ...batchRow, lista_nombre: lista?.nombre ?? null };
  const detalle = db.select({
    id: schema.price_batch_detalle.id,
    producto_id: schema.price_batch_detalle.producto_id,
    nombre_corto: schema.producto.nombre_corto,
    sku: schema.producto.sku,
    costo_neto_centavos: schema.price_batch_detalle.costo_neto_centavos,
    precio_anterior_centavos: schema.price_batch_detalle.precio_anterior_centavos,
    precio_propuesto_centavos: schema.price_batch_detalle.precio_propuesto_centavos,
    margen_anterior_pct: schema.price_batch_detalle.margen_anterior_pct,
    margen_nuevo_pct: schema.price_batch_detalle.margen_nuevo_pct,
    regla_precio_id: schema.price_batch_detalle.regla_precio_id,
    variacion_pct: schema.price_batch_detalle.variacion_pct,
    estado_validacion: schema.price_batch_detalle.estado_validacion,
    motivo_validacion: schema.price_batch_detalle.motivo_validacion,
  })
    .from(schema.price_batch_detalle)
    .innerJoin(schema.producto, eq(schema.price_batch_detalle.producto_id, schema.producto.id))
    .where(eq(schema.price_batch_detalle.price_batch_id, id))
    .all();
  return { batch, detalle };
}

type BatchEstado = typeof schema.price_batch.$inferSelect.estado;
const ESTADOS_ACTIVOS: BatchEstado[] = ['borrador', 'validado', 'pendiente_aprobacion', 'aprobado', 'validacion_fallida'];

export function listarBatchesHandler(db: Db, filtros?: { estado?: string; soloActivos?: boolean }) {
  requirePerm('precio.gestionar');
  const q = db.select({
    id: schema.price_batch.id,
    lista_precio_id: schema.price_batch.lista_precio_id,
    lista_nombre: schema.lista_precio.nombre,
    proveedor_id: schema.price_batch.proveedor_id,
    origen: schema.price_batch.origen,
    estado: schema.price_batch.estado,
    productos_ok: schema.price_batch.productos_ok,
    advertencias: schema.price_batch.advertencias,
    errores: schema.price_batch.errores,
    excluidas: schema.price_batch.excluidas,
    impacto_incremento_centavos: schema.price_batch.impacto_incremento_centavos,
    fecha_creacion: schema.price_batch.fecha_creacion,
  })
    .from(schema.price_batch)
    .innerJoin(schema.lista_precio, eq(schema.price_batch.lista_precio_id, schema.lista_precio.id));

  let rows;
  if (filtros?.estado) {
    rows = q.where(eq(schema.price_batch.estado, filtros.estado as BatchEstado)).orderBy(desc(schema.price_batch.fecha_creacion)).all();
  } else if (filtros?.soloActivos !== false) {
    rows = q.where(inArray(schema.price_batch.estado, ESTADOS_ACTIVOS)).orderBy(desc(schema.price_batch.fecha_creacion)).all();
  } else {
    rows = q.orderBy(desc(schema.price_batch.fecha_creacion)).all();
  }
  return rows;
}

export function excluirFilaHandler(db: Db, filaId: string) {
  requirePerm('precio.gestionar');
  excluirFila(db, filaId);
  return { ok: true };
}

export function excluirErroresHandler(db: Db, batchId: string) {
  requirePerm('precio.gestionar');
  excluirErrores(db, batchId);
  return { ok: true };
}

export function revalidarBatchHandler(db: Db, id: string) {
  requirePerm('precio.gestionar');
  return revalidarBatch(db, id);
}

export function aprobarBatchHandler(db: Db, rawId: unknown) {
  const session = requirePerm('precio.aprobar');
  const id = vId(rawId, 'id');
  aprobarBatch(db, id, session.userId);
  return { id, estado: 'aprobado' };
}

export function publicarBatchHandler(db: Db, rawId: unknown) {
  const session = requirePerm('precio.aprobar');
  const id = vId(rawId, 'id');
  return publicarBatch(db, id, session.userId);
}

export function revertirBatchHandler(db: Db, rawId: unknown) {
  const session = requirePerm('precio.aprobar');
  const id = vId(rawId, 'id');
  return revertirBatch(db, id, session.userId);
}

export function registerPriceBatchHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('priceBatch:crear',         async (_e, p)  => crearBatchHandler(db, p));
  ipcMain.handle('priceBatch:obtener',       async (_e, id) => obtenerBatchHandler(db, id));
  ipcMain.handle('priceBatch:listar',        async (_e, f)  => listarBatchesHandler(db, f));
  ipcMain.handle('priceBatch:excluirFila',   async (_e, id) => excluirFilaHandler(db, id));
  ipcMain.handle('priceBatch:excluirErrores', async (_e, id) => excluirErroresHandler(db, id));
  ipcMain.handle('priceBatch:aprobar',       async (_e, id) => aprobarBatchHandler(db, id));
  ipcMain.handle('priceBatch:publicar',      async (_e, id) => publicarBatchHandler(db, id));
  ipcMain.handle('priceBatch:revertir',      async (_e, id) => revertirBatchHandler(db, id));
  ipcMain.handle('priceBatch:revalidar',    async (_e, id) => revalidarBatchHandler(db, id));
}
