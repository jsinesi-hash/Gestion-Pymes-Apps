import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { formatSku } from '@ferreteria/shared';
import * as schema from '../db/schema';

type TxSku = Pick<BetterSQLite3Database<typeof schema>, 'select' | 'update'>;

/**
 * Reserva el próximo SKU del bloque local de la terminal, dentro de la transacción del alta (si la
 * transacción falla, el número no se consume). ADR-154 §2: el formato `P-NNNNNNN-D` no cambia.
 *
 * - `sku_proximo_secuencial`: próximo número a entregar (valor local, no sincroniza).
 * - `sku_bloque_hasta`: último número del bloque que el hub le asignó a esta terminal. En standalone
 *   no existe y el bloque es todo el rango. Sin números en el bloque lanza `SKU_SIN_BLOQUE`: no se
 *   pueden dar de alta productos hasta recibir otro bloque (la venta sigue).
 */
export function reservarSku(tx: TxSku): { sku: string; secuencial: number } {
  const leer = (clave: string) => tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  const row = leer('sku_proximo_secuencial');
  if (!row) throw new Error('sku_proximo_secuencial no encontrado en parametros_sistema');
  const secuencial = Number.parseInt(row.valor, 10);
  const hasta = leer('sku_bloque_hasta');
  if (hasta && secuencial > Number.parseInt(hasta.valor, 10)) throw new Error('SKU_SIN_BLOQUE');
  tx.update(schema.parametros_sistema)
    .set({ valor: String(secuencial + 1), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'sku_proximo_secuencial')).run();
  return { sku: formatSku(secuencial), secuencial };
}
