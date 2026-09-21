import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../seed';

describe('runCatalogSeed', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); });

  it('crea impuesto IVA 21% predeterminado e IVA 10.5% y Exento', () => {
    runCatalogSeed(db);
    const imp = db.select().from(schema.impuesto).all();
    expect(imp).toHaveLength(3);
    const iva21 = imp.find(i => i.nombre === 'IVA 21%')!;
    expect(iva21.alicuota).toBe(21);
    expect(iva21.predeterminado).toBe(true);
    expect(imp.map(i => i.nombre)).toContain('IVA 10.5%');
    expect(imp.map(i => i.nombre)).toContain('Exento');
  });

  it('es idempotente', () => {
    runCatalogSeed(db);
    runCatalogSeed(db);
    expect(db.select().from(schema.impuesto).all()).toHaveLength(3);
  });
});
