import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';

/** Lo que la proyección necesita de la base; cualquier app la cumple con su esquema compuesto. */
type DbSaldos = Pick<BetterSQLite3Database<typeof schema>, 'select' | 'update' | 'all'>;

/**
 * Saldo de una cuenta corriente proyectado desde su libro (ADR-151): cargos menos pagos. Los montos
 * del libro son siempre positivos y el signo lo da el tipo. No hay punto de corte: el saldo inicial
 * también es un movimiento (`saldo_inicial`).
 */
export function proyectarSaldoCuentaCorriente(db: DbSaldos, cuentaId: string): number {
  const fila = db.all<{ saldo: number | null }>(sql`
    select sum(case tipo when 'cargo' then monto_centavos else -monto_centavos end) as saldo
    from movimiento_cuenta_corriente where cuenta_id = ${cuentaId}`)[0];
  return fila?.saldo ?? 0;
}

/** Cuentas cuyo saldo guardado no coincide con la proyección del libro (test de integridad). */
export function diferenciasDeCuentaCorriente(db: DbSaldos): { cuenta_id: string; guardado: number; proyectado: number }[] {
  return db.select({ cuenta_id: schema.cuenta_corriente_cliente.id, guardado: schema.cuenta_corriente_cliente.saldo_centavos })
    .from(schema.cuenta_corriente_cliente).all()
    .map((c) => ({ ...c, proyectado: proyectarSaldoCuentaCorriente(db, c.cuenta_id) }))
    .filter((c) => c.guardado !== c.proyectado);
}

/** Reconstruye el saldo guardado desde el libro; solo escribe si no coincide. */
export function recalcularSaldoCuentaCorriente(
  db: DbSaldos, cuentaId: string,
): { guardado: number; proyectado: number; corregido: boolean } {
  const fila = db.select().from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get();
  if (!fila) throw new Error('NOT_FOUND');
  const proyectado = proyectarSaldoCuentaCorriente(db, cuentaId);
  const corregido = fila.saldo_centavos !== proyectado;
  if (corregido) {
    db.update(schema.cuenta_corriente_cliente).set({
      saldo_centavos: proyectado, version: fila.version + 1, sync_state: 'pending', updated_at: new Date(),
    }).where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).run();
  }
  return { guardado: fila.saldo_centavos, proyectado, corregido };
}
