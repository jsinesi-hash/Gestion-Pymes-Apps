import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

const SYNC  = { version: 1, origin_id: 'system', sync_state: 'synced' as const };
const AUDIT = { usuario_creacion_id: 'system' };

const IMPUESTOS = [
  { nombre: 'IVA 21%',   tipo: 'iva'    as const, alicuota: 21,   predeterminado: true  },
  { nombre: 'IVA 10.5%', tipo: 'iva'    as const, alicuota: 10.5, predeterminado: false },
  { nombre: 'Exento',    tipo: 'exento' as const, alicuota: 0,    predeterminado: false },
];

export function runCatalogSeedElaborados(db: Db): void {
  const now  = new Date();
  const base = { ...SYNC, ...AUDIT, fecha_creacion: now, updated_at: now, activo: true };

  for (const imp of IMPUESTOS) {
    const exists = db.select({ id: schema.impuesto.id })
      .from(schema.impuesto)
      .where(eq(schema.impuesto.nombre, imp.nombre))
      .get();
    if (!exists) {
      db.insert(schema.impuesto).values({ id: randomUUID(), ...imp, ...base }).run();
    }
  }
}

export const CONSUMIDOR_FINAL_ID = 'cf000000-0000-0000-0000-000000000001';

/** Cliente fijo para ventas de mostrador (mismo id que Retail). Idempotente; corre en cada arranque. */
export function asegurarConsumidorFinal(db: Db): void {
  const now = new Date();
  db.insert(schema.cliente).values({
    id: CONSUMIDOR_FINAL_ID, tipo_documento: 'CUIT', numero_documento: '00000000000',
    nombre: 'Consumidor', apellido: 'Final', condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: false, activo: true,
    usuario_creacion_id: 'system', fecha_creacion: now,
    version: 1, origin_id: 'system', sync_state: 'synced', updated_at: now,
  }).onConflictDoNothing().run();
}
