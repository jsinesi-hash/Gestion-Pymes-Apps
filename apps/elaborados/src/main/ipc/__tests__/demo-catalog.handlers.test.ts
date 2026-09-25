import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { demoHeladeriaSeedHandler } from '../demo-catalog';

type Db = ReturnType<typeof setupDb>;

describe('demo-catalog handler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); runCatalogSeedElaborados(db); });

  it('siembra el catálogo demo bajo demanda', () => {
    loginAsAdmin(db);
    demoHeladeriaSeedHandler(db);
    expect(db.select().from(schema.categoria_venta).all().length).toBeGreaterThan(0);
  });

  it('exige sesión de un usuario con permiso de administración', () => {
    clearSession();
    expect(() => demoHeladeriaSeedHandler(db)).toThrow('UNAUTHENTICATED');
  });
});
