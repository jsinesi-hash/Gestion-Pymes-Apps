import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { impuestoListHandler } from '@core/main';

describe('impuesto handlers (Elaborados)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeedElaborados(db); clearSession(); });

  it('sin sesión rechaza con UNAUTHENTICATED', () => {
    expect(() => impuestoListHandler(db)).toThrow('UNAUTHENTICATED');
  });

  it('list devuelve los impuestos activos sembrados por el catálogo', () => {
    loginAsAdmin(db);
    expect(impuestoListHandler(db)).toHaveLength(3);
  });
});
