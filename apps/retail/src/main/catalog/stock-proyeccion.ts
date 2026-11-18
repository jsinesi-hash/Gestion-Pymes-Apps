import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { costoPromedioEntrada } from '@ferreteria/shared';
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

/** Entradas cuyo costo entra al promedio: las mismas que lo actualizan en los handlers. */
const MOTIVOS_CON_COSTO = new Set(['inicial', 'entrada_manual', 'recepcion_compra']);

/**
 * Costo promedio ponderado (centavos) proyectado desde el libro (ADR-151, corrección de F1 PR1): se
 * reproducen los movimientos en orden, siguiendo el stock (el conteo lo vuelve a fijar), y cada
 * entrada con costo de esos motivos aplica `costoPromedioEntrada` (ADR-157), con el mismo redondeo
 * al centavo que los handlers. Ventas, devoluciones y salidas no lo cambian.
 */
export function proyectarCostoPromedio(db: Db, productoId: string): number {
  const movs = db.all<{ tipo: string; motivo: string; cantidad: number; stock_resultante: number; costo_unitario_centavos: number | null }>(sql`
    select tipo, motivo, cantidad, stock_resultante, costo_unitario_centavos from movimiento_stock
    where producto_id = ${productoId} order by fecha, rowid`);
  let stock = 0;
  let costo = 0;
  for (const m of movs) {
    if (m.motivo === 'ajuste_conteo') { stock = m.stock_resultante; continue; }
    const q = m.tipo === 'salida' ? -Math.abs(m.cantidad) : m.tipo === 'entrada' ? Math.abs(m.cantidad) : m.cantidad;
    if (m.tipo === 'entrada' && MOTIVOS_CON_COSTO.has(m.motivo) && m.costo_unitario_centavos != null && m.costo_unitario_centavos > 0) {
      costo = costoPromedioEntrada(stock, costo, q, m.costo_unitario_centavos);
    }
    stock += q;
  }
  return costo;
}

/** Productos cuyo costo promedio guardado no coincide con la proyección del libro. */
export function diferenciasDeCostoPromedio(db: Db): { producto_id: string; guardado: number; proyectado: number }[] {
  return db.select({ producto_id: schema.producto.id, guardado: schema.producto.precio_costo_promedio_centavos })
    .from(schema.producto).all()
    .map((p) => ({ ...p, proyectado: proyectarCostoPromedio(db, p.producto_id) }))
    .filter((p) => p.guardado !== p.proyectado);
}

/** Reconstruye el costo promedio guardado desde el libro; solo escribe si no coincide. */
export function recalcularCostoPromedio(db: Db, productoId: string): { guardado: number; proyectado: number; corregido: boolean } {
  const fila = db.select().from(schema.producto).where(eq(schema.producto.id, productoId)).get();
  if (!fila) throw new Error('NOT_FOUND');
  const proyectado = proyectarCostoPromedio(db, productoId);
  const corregido = fila.precio_costo_promedio_centavos !== proyectado;
  if (corregido) {
    db.update(schema.producto).set({
      precio_costo_promedio_centavos: proyectado, version: fila.version + 1, sync_state: 'pending', updated_at: new Date(),
    }).where(eq(schema.producto.id, productoId)).run();
  }
  return { guardado: fila.precio_costo_promedio_centavos, proyectado, corregido };
}

/** Marca en `parametros_sistema` del recálculo de una sola vez tras pasar el costo a centavos. */
export const CLAVE_COSTO_PROMEDIO_RECALCULADO = 'costo_promedio_centavos_recalculado';

/**
 * ADR-157 (PR-C3): la migración 0061 convierte el costo promedio guardado con ROUND(pesos × 100),
 * pero el promedio en pesos venía sin redondear en cada entrada, así que puede diferir en un
 * centavo de la proyección, que redondea por entrada. Esto lo reconstruye desde el libro una sola
 * vez por base (tarea local, marcada en `parametros_sistema`). Devuelve cuántos productos corrigió.
 */
export function recalcularCostosPromedioUnaVez(db: Db): number {
  const hecho = db.select({ valor: schema.parametros_sistema.valor }).from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, CLAVE_COSTO_PROMEDIO_RECALCULADO)).get();
  if (hecho?.valor === 'true') return 0;
  return db.transaction((tx) => {
    const ids = tx.select({ id: schema.producto.id }).from(schema.producto).all();
    let corregidos = 0;
    for (const { id } of ids) {
      if (recalcularCostoPromedio(tx as unknown as Db, id).corregido) corregidos++;
    }
    tx.insert(schema.parametros_sistema).values({
      clave: CLAVE_COSTO_PROMEDIO_RECALCULADO,
      valor: 'true',
      tipo: 'bool',
      descripcion: 'Costo promedio reconstruido desde el libro tras pasar a centavos (ADR-157, una sola vez).',
      actualizado_en: new Date(),
    }).onConflictDoUpdate({
      target: schema.parametros_sistema.clave,
      set: { valor: 'true', actualizado_en: new Date() },
    }).run();
    return corregidos;
  });
}

/** Evita arrastrar ruido de coma flotante (0.1 + 0.2) a la comparación y al saldo corregido. */
function redondear(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
