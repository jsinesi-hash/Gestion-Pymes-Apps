// Proyecciones de Retail después de un pull (F2 PR3, ADR-151 §2): el stock y el costo promedio no
// viajan; cada terminal los recalcula desde `movimiento_stock` para los productos que tocó lo recibido.
// Corre dentro de la transacción de la página, con el interruptor de aplicación encendido.
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { CambioAplicado } from '@core/main';
import * as schema from '../db/schema';
import { recalcularCostoPromedio, recalcularStock } from '../catalog/stock-proyeccion';

type Db = BetterSQLite3Database<typeof schema>;

/** Productos cuyo stock o costo pudo cambiar con lo recibido. */
export function productosTocados(aplicados: readonly CambioAplicado[]): Set<string> {
  const ids = new Set<string>();
  for (const a of aplicados) {
    if (a.tabla === 'movimiento_stock') ids.add(String(a.fila['producto_id']));
    // Un producto o una existencia nuevos llegan sin su proyección: se calcula de su libro.
    if (a.nueva && a.tabla === 'existencias') ids.add(String(a.fila['producto_id']));
    if (a.nueva && a.tabla === 'producto') ids.add(String(a.fila['id']));
  }
  return ids;
}

export function proyeccionesRetail(db: Db): (aplicados: readonly CambioAplicado[]) => void {
  return (aplicados) => {
    for (const id of productosTocados(aplicados)) {
      if (db.select({ id: schema.producto.id }).from(schema.producto).where(eq(schema.producto.id, id)).get()) {
        recalcularCostoPromedio(db, id);
      }
      if (db.select({ id: schema.existencias.id }).from(schema.existencias).where(eq(schema.existencias.producto_id, id)).get()) {
        recalcularStock(db, id);
      }
    }
  };
}
