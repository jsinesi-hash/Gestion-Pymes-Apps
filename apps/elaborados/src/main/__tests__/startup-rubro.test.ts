import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createTestDb } from './helpers';
import { runStartup } from '../startup';

const opts = { skipBackup: true, skipMigrations: true, geoCache: '/no-existe-geo-cache' };

describe('runStartup — seed base del rubro', () => {
  it('siembra las 5 categorías y marca sistema.seed_rubro_aplicado', async () => {
    const db = createTestDb();
    await runStartup(db, opts);
    expect(db.select().from(schema.categoria_venta).all()).toHaveLength(5);
    const flag = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'sistema.seed_rubro_aplicado')).get();
    expect(flag?.valor).toBe('true');
  });

  it('un segundo arranque no duplica ni recrea lo que se borró', async () => {
    const db = createTestDb();
    await runStartup(db, opts);
    db.delete(schema.categoria_venta).where(eq(schema.categoria_venta.nombre, 'Tortas')).run();
    await runStartup(db, opts);
    const cats = db.select().from(schema.categoria_venta).all();
    expect(cats).toHaveLength(4);
    expect(cats.some((c) => c.nombre === 'Tortas')).toBe(false);
  });
});
