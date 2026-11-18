import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { costoPromedioEntrada } from '@ferreteria/shared';

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

/** Entradas que promedian el costo: las mismas que lo actualizan en los handlers (las anulaciones no lo revierten). */
const MOTIVOS_CON_COSTO = new Set(['compra', 'produccion_alta']);

/**
 * Costo promedio (centavos) proyectado desde el libro (ADR-151, corrección de F1 PR1): se
 * reproducen los movimientos en orden siguiendo el stock (el conteo lo vuelve a fijar) y cada
 * compra o alta de producción con costo aplica `costoPromedioEntrada`, con su mismo redondeo.
 */
export function proyectarCostoPromedio(db: Db, articuloId: string): number {
  const movs = db.all<{ motivo: string; cantidad: number; stock_resultante: number; costo_unitario_centavos: number | null }>(sql`
    select motivo, cantidad, stock_resultante, costo_unitario_centavos from movimiento_articulo
    where articulo_id = ${articuloId} order by fecha, rowid`);
  let stock = 0;
  let costo = 0;
  for (const m of movs) {
    if (m.motivo === 'conteo') { stock = m.stock_resultante; continue; }
    if (MOTIVOS_CON_COSTO.has(m.motivo) && m.cantidad > 0 && m.costo_unitario_centavos != null) {
      costo = costoPromedioEntrada(stock, costo, m.cantidad, m.costo_unitario_centavos);
    }
    stock += m.cantidad;
  }
  return costo;
}

/** Artículos cuyo costo promedio guardado no coincide con la proyección del libro. */
export function diferenciasDeCostoPromedio(db: Db): { articulo_id: string; guardado: number; proyectado: number }[] {
  return db.select({ articulo_id: schema.articulo.id, guardado: schema.articulo.costo_promedio_centavos })
    .from(schema.articulo).all()
    .map((a) => ({ ...a, proyectado: proyectarCostoPromedio(db, a.articulo_id) }))
    .filter((a) => a.guardado !== a.proyectado);
}

/** Reconstruye el costo promedio guardado desde el libro; solo escribe si no coincide. */
export function recalcularCostoPromedio(db: Db, articuloId: string): { guardado: number; proyectado: number; corregido: boolean } {
  const fila = db.select().from(schema.articulo).where(eq(schema.articulo.id, articuloId)).get();
  if (!fila) throw new Error('NOT_FOUND');
  const proyectado = proyectarCostoPromedio(db, articuloId);
  const corregido = fila.costo_promedio_centavos !== proyectado;
  if (corregido) {
    db.update(schema.articulo).set({
      costo_promedio_centavos: proyectado, version: fila.version + 1, sync_state: 'pending', updated_at: new Date(),
    }).where(eq(schema.articulo.id, articuloId)).run();
  }
  return { guardado: fila.costo_promedio_centavos, proyectado, corregido };
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
