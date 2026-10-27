import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { impuestoListHandler } from '@core/main';

describe('impuesto handlers', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); });

  it('lista impuestos activos', () => {
    expect(impuestoListHandler(db)).toHaveLength(3);
    expect(impuestoListHandler(db).map(i => i.nombre)).toContain('IVA 21%');
  });
});
