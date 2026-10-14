import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';

type Db = BetterSQLite3Database<typeof schema>;

/** Lista de precios asignada al cliente, o `null` si no tiene (o no se indicó cliente). */
export function listaDeCliente(db: Db, clienteId: string | undefined): string | null {
  if (!clienteId) return null;
  const cliente = db.select({ lista_precio_id: schema.cliente.lista_precio_id })
    .from(schema.cliente).where(eq(schema.cliente.id, clienteId)).get();
  return cliente?.lista_precio_id ?? null;
}

/**
 * ADR-049 §9 / ADR-104 — Price List Resolver universal: `cliente.lista_precio_id` → `listaIdFallback`
 * (la predeterminada, que ya resuelve el caller). Sin `clienteId`, o sin lista propia,
 * devuelve el fallback tal cual.
 */
export function resolverListaEfectiva(db: Db, clienteId: string | undefined, listaIdFallback: string): string {
  return listaDeCliente(db, clienteId) ?? listaIdFallback;
}
