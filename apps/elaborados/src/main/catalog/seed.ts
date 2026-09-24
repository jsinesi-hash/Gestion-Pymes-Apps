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
