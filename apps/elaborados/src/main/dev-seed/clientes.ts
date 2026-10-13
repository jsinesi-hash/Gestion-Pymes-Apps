import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export type ClienteDemo = {
  nombre: string;
  apellido: string;
  numero_documento: string;
  telefono?: string;
  /** Límite de crédito en centavos; si está, el cliente tiene cuenta corriente habilitada. */
  limite_credito_centavos?: number;
};

/**
 * Clientes de ejemplo (documentos ficticios). Los 4 primeros son consumidores finales sin
 * cuenta; los 2 últimos tienen cuenta corriente: uno con límite chico ($20.000) para probar
 * el pedido de Supervisor al excederlo, y otro holgado ($500.000).
 */
export const CLIENTES_DEMO: readonly ClienteDemo[] = [
  { nombre: 'Lucía', apellido: 'Benítez', numero_documento: '90000001' },
  { nombre: 'Martín', apellido: 'Acosta', numero_documento: '90000002' },
  { nombre: 'Sofía', apellido: 'Herrera', numero_documento: '90000003' },
  { nombre: 'Tomás', apellido: 'Ibarra', numero_documento: '90000004' },
  { nombre: 'Carla', apellido: 'Medina', numero_documento: '90000005', telefono: '2614000005', limite_credito_centavos: 2_000_000 },
  { nombre: 'Julián', apellido: 'Ortiz', numero_documento: '90000006', telefono: '2614000006', limite_credito_centavos: 50_000_000 },
];

/** Inserta los clientes demo que falten (por `numero_documento`). Idempotente. */
export function seedClientesDemo(db: Db): { creados: number } {
  const now = new Date();
  const sync = { version: 1, origin_id: 'system', sync_state: 'synced' as const, updated_at: now };
  let creados = 0;

  db.transaction((tx) => {
    for (const c of CLIENTES_DEMO) {
      const existe = tx.select({ id: schema.cliente.id }).from(schema.cliente)
        .where(eq(schema.cliente.numero_documento, c.numero_documento)).get();
      if (existe) continue;

      const conCuenta = c.limite_credito_centavos != null;
      const clienteId = randomUUID();
      tx.insert(schema.cliente).values({
        id: clienteId, tipo_documento: 'DNI', numero_documento: c.numero_documento,
        nombre: c.nombre, apellido: c.apellido, condicion_fiscal: 'Consumidor Final',
        telefono: c.telefono ?? null,
        habilita_cuenta_corriente: conCuenta, activo: true,
        usuario_creacion_id: 'system', fecha_creacion: now, ...sync,
      }).run();
      if (conCuenta) {
        tx.insert(schema.cuenta_corriente_cliente).values({
          id: randomUUID(), cliente_id: clienteId, saldo_centavos: 0,
          limite_credito_centavos: c.limite_credito_centavos!, activo: true, ...sync,
        }).run();
      }
      creados++;
    }
  });

  return { creados };
}
