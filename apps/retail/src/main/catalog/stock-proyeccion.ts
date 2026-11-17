import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

/** Dos stocks son el mismo si difieren menos que esto (las cantidades fraccionarias son REAL). */
const EPS = 1e-6;

/**
 * Efecto de un movimiento sobre el stock. El libro no es uniforme y es inmutable, así que la regla
 * se adapta a lo que hay: la venta guarda la salida en positivo y la merma en negativo (las dos con
 * tipo `salida`); las entradas van en positivo; el ajuste guarda la diferencia con su signo.
 */
const EFECTO = sql`case ${schema.movimiento_stock.tipo}
  when 'salida' then -abs(${schema.movimiento_stock.cantidad})
  when 'entrada' then abs(${schema.movimiento_stock.cantidad})
  else ${schema.movimiento_stock.cantidad} end`;

/**
 * Stock proyectado desde el libro (ADR-151 §4): el último conteo (`ajuste_conteo`, cuyo
 * `stock_resultante` es la cantidad contada) más los movimientos posteriores a él. Sin conteos,
 * la suma de todo el libro. El orden es la fecha del movimiento y, a igual fecha, el orden de
 * llegada: un movimiento de otra terminal fechado antes del conteo no lo modifica, porque el
 * conteo físico ya lo incluía.
 */
export function proyectarStock(db: Db, productoId: string): number {
  const conteo = db.all<{ stock_resultante: number; fecha: number; orden: number }>(sql`
    select stock_resultante, fecha, rowid as orden from movimiento_stock
    where producto_id = ${productoId} and motivo = 'ajuste_conteo'
    order by fecha desc, rowid desc limit 1`)[0];
  const posteriores = conteo
    ? sql`and (fecha > ${conteo.fecha} or (fecha = ${conteo.fecha} and rowid > ${conteo.orden}))`
    : sql``;
  const suma = db.all<{ total: number | null }>(sql`
    select sum(${EFECTO}) as total from movimiento_stock
    where producto_id = ${productoId} ${posteriores}`)[0]?.total ?? 0;
  return redondear((conteo?.stock_resultante ?? 0) + suma);
}

/** Productos cuyo stock guardado no coincide con la proyección del libro (test de integridad). */
export function diferenciasDeStock(db: Db): { producto_id: string; guardado: number; proyectado: number }[] {
  return db.select({ producto_id: schema.existencias.producto_id, guardado: schema.existencias.stock_fisico })
    .from(schema.existencias).all()
    .map((e) => ({ ...e, proyectado: proyectarStock(db, e.producto_id) }))
    .filter((e) => Math.abs(e.guardado - e.proyectado) > EPS);
}

/**
 * Reconstruye el stock guardado desde el libro. Solo escribe si no coincide; devuelve qué había y
 * qué quedó. La usará el pull de F2 y sirve para corregir una base cuyo saldo se desfasó.
 */
export function recalcularStock(db: Db, productoId: string): { guardado: number; proyectado: number; corregido: boolean } {
  const fila = db.select().from(schema.existencias).where(eq(schema.existencias.producto_id, productoId)).get();
  if (!fila) throw new Error('NOT_FOUND');
  const proyectado = proyectarStock(db, productoId);
  const corregido = Math.abs(fila.stock_fisico - proyectado) > EPS;
  if (corregido) {
    db.update(schema.existencias).set({
      stock_fisico: proyectado, version: fila.version + 1, sync_state: 'pending', updated_at: new Date(),
    }).where(eq(schema.existencias.producto_id, productoId)).run();
  }
  return { guardado: fila.stock_fisico, proyectado, corregido };
}

/** Evita arrastrar ruido de coma flotante (0.1 + 0.2) a la comparación y al saldo corregido. */
function redondear(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
