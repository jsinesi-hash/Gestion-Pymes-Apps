import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { getOriginId } from './context';

/**
 * Lo único que la numeración necesita de una transacción. Cualquier app la cumple con su propio
 * esquema compuesto, porque `parametros_sistema` es del núcleo.
 */
type TxNumeracion = Pick<BetterSQLite3Database<typeof schema>, 'select' | 'insert' | 'update'>;

/** `<PREFIJO>-<terminal>-NNNNNN` (ADR-154): el mismo formato que la venta y la orden de compra. */
export function numeroPorTerminal(prefijo: string, terminal: string, correlativo: number): string {
  return `${prefijo}-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

/**
 * Asigna el próximo número de un documento para la terminal actual, dentro de la transacción de
 * emisión: si la transacción falla, el número no se consume. El correlativo vive en
 * `parametros_sistema` como `<documento>_correlativo_<terminal>` y se crea en el primer uso, así
 * que dos terminales nunca repiten número aunque emitan sin conexión entre sí (ADR-154).
 */
export function siguienteNumeroPorTerminal(
  tx: TxNumeracion,
  prefijo: string,
  documento: string,
): { numero: string; correlativo: number } {
  const terminal = getOriginId();
  const clave = `${documento}_correlativo_${terminal}`;
  const now = new Date();
  const fila = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  const correlativo = fila ? Number.parseInt(fila.valor, 10) + 1 : 1;
  if (fila) {
    tx.update(schema.parametros_sistema)
      .set({ valor: String(correlativo), actualizado_en: now })
      .where(eq(schema.parametros_sistema.clave, clave)).run();
  } else {
    tx.insert(schema.parametros_sistema).values({
      clave, valor: String(correlativo), tipo: 'number',
      descripcion: `Correlativo de ${documento} de la terminal ${terminal}`,
      actualizado_en: now,
    }).run();
  }
  return { numero: numeroPorTerminal(prefijo, terminal, correlativo), correlativo };
}
