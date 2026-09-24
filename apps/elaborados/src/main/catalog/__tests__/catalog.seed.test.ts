import { describe, it, expect } from 'vitest';
import * as schema from '../../db/schema';
import { createTestDb } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../seed';

describe('runCatalogSeedElaborados', () => {
  it('siembra los 3 impuestos base', () => {
    const db = createTestDb();
    runCatalogSeedElaborados(db);
    const rows = db.select().from(schema.impuesto).all();
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.nombre === 'IVA 21%')?.predeterminado).toBe(true);
  });

  it('es idempotente', () => {
    const db = createTestDb();
    runCatalogSeedElaborados(db);
    runCatalogSeedElaborados(db);
    expect(db.select().from(schema.impuesto).all()).toHaveLength(3);
  });
});
