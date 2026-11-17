import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

/** Dos stocks son el mismo si difieren menos que esto (las cantidades fraccionarias son REAL). */
const EPS = 1e-6;

/**
 * Stock de un artículo proyectado desde su libro (ADR-151 §4). El libro de Elaborados guarda la
 * cantidad con su signo. Punto de corte: el último movimiento con motivo `conteo`, cuyo
 * `stock_resultante` es la cantidad contada (la pantalla de conteo pide el stock nuevo y manda la
 * diferencia contra el stock local). Orden: fecha y, a igual fecha, orden de llegada. El stock
 * negativo (artículos sin `bloquea_sin_stock`) se proyecta tal cual.
 */
export function proyectarStock(db: Db, articuloId: string): number {
  const conteo = db.all<{ stock_resultante: number; fecha: number; orden: number }>(sql`
    select stock_resultante, fecha, rowid as orden from movimiento_articulo
    where articulo_id = ${articuloId} and motivo = 'conteo'
    order by fecha desc, rowid desc limit 1`)[0];
  const posteriores = conteo
    ? sql`and (fecha > ${conteo.fecha} or (fecha = ${conteo.fecha} and rowid > ${conteo.orden}))`
    : sql``;
  const suma = db.all<{ total: number | null }>(sql`
    select sum(cantidad) as total from movimiento_articulo
    where articulo_id = ${articuloId} ${posteriores}`)[0]?.total ?? 0;
  return Math.round(((conteo?.stock_resultante ?? 0) + suma) * 1e6) / 1e6;
}

/** Artículos cuyo stock guardado no coincide con la proyección del libro (test de integridad). */
export function diferenciasDeStock(db: Db): { articulo_id: string; guardado: number; proyectado: number }[] {
  return db.select({ articulo_id: schema.existencia_articulo.articulo_id, guardado: schema.existencia_articulo.stock })
    .from(schema.existencia_articulo).all()
    .map((e) => ({ ...e, proyectado: proyectarStock(db, e.articulo_id) }))
    .filter((e) => Math.abs(e.guardado - e.proyectado) > EPS);
}

/** Reconstruye el stock guardado desde el libro; solo escribe si no coincide. */
export function recalcularStock(db: Db, articuloId: string): { guardado: number; proyectado: number; corregido: boolean } {
  const fila = db.select().from(schema.existencia_articulo)
    .where(eq(schema.existencia_articulo.articulo_id, articuloId)).get();
  if (!fila) throw new Error('NOT_FOUND');
  const proyectado = proyectarStock(db, articuloId);
  const corregido = Math.abs(fila.stock - proyectado) > EPS;
  if (corregido) {
    db.update(schema.existencia_articulo).set({
      stock: proyectado, version: fila.version + 1, sync_state: 'pending', updated_at: new Date(),
    }).where(eq(schema.existencia_articulo.articulo_id, articuloId)).run();
  }
  return { guardado: fila.stock, proyectado, corregido };
}
