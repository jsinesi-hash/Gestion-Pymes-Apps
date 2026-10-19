import { and, eq, gt, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export interface ProductoBajoMinimo {
  producto_id: string;
  sku: string;
  nombre_corto: string;
  stock_fisico: number;
  stock_minimo: number;
  faltante: number;
  /** stock_fisico <= 0: el producto no tiene nada para vender. */
  agotado: boolean;
}

/**
 * Definición única de "bajo mínimo": productos activos con stock_minimo > 0 y
 * stock_fisico <= stock_minimo. Ordenados por faltante descendente.
 * Cada consumidor decide qué hacer con `agotado` (el dashboard separa los agotados en
 * su propia lista; el cierre de caja los conserva).
 */
export function productosBajoMinimo(db: Db): ProductoBajoMinimo[] {
  const rows = db.select({
    producto_id: schema.producto.id,
    sku: schema.producto.sku,
    nombre_corto: schema.producto.nombre_corto,
    stock_fisico: schema.existencias.stock_fisico,
    stock_minimo: schema.existencias.stock_minimo,
  }).from(schema.existencias)
    .innerJoin(schema.producto, eq(schema.producto.id, schema.existencias.producto_id))
    .where(and(
      eq(schema.producto.activo, true),
      gt(schema.existencias.stock_minimo, 0),
      sql`${schema.existencias.stock_fisico} <= ${schema.existencias.stock_minimo}`,
    ))
    .all();
  return rows
    .map((r) => ({ ...r, faltante: r.stock_minimo - r.stock_fisico, agotado: r.stock_fisico <= 0 }))
    .sort((a, b) => b.faltante - a.faltante);
}
