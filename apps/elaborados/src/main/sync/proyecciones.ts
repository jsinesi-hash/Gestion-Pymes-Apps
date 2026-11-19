// Proyecciones de Elaborados después de un pull (F2 PR3, ADR-151 §2): el stock y el costo promedio no
// viajan; cada terminal los recalcula desde `movimiento_articulo` para los artículos que tocó lo recibido.
// Corre dentro de la transacción de la página, con el interruptor de aplicación encendido.
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { CambioAplicado } from '@core/main';
import * as schema from '../db/schema';
import { recalcularCostoPromedio, recalcularStock } from '../catalog/stock-proyeccion';

type Db = BetterSQLite3Database<typeof schema>;

/** Artículos cuyo stock o costo pudo cambiar con lo recibido. */
export function articulosTocados(aplicados: readonly CambioAplicado[]): Set<string> {
  const ids = new Set<string>();
  for (const a of aplicados) {
    if (a.tabla === 'movimiento_articulo') ids.add(String(a.fila['articulo_id']));
    // Un artículo o una existencia nuevos llegan sin su proyección: se calcula de su libro.
    if (a.nueva && a.tabla === 'existencia_articulo') ids.add(String(a.fila['articulo_id']));
    if (a.nueva && a.tabla === 'articulo') ids.add(String(a.fila['id']));
  }
  return ids;
}

export function proyeccionesElaborados(db: Db): (aplicados: readonly CambioAplicado[]) => void {
  return (aplicados) => {
    for (const id of articulosTocados(aplicados)) {
      if (db.select({ id: schema.articulo.id }).from(schema.articulo).where(eq(schema.articulo.id, id)).get()) {
        recalcularCostoPromedio(db, id);
      }
      if (db.select({ id: schema.existencia_articulo.id }).from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, id)).get()) {
        recalcularStock(db, id);
      }
    }
  };
}
