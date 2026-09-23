import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { createTestDb } from './ipc/__tests__/helpers';
import { isSeedBaseAplicado } from './base-seed/index';
import { runStartup } from './startup';

const GEO_CACHE = path.resolve(__dirname, '../../../../packages/core-main/geo-cache');

describe('runStartup — first-run guard', () => {
  it('siembra seed:base en primer arranque y setea el flag', async () => {
    const db = createTestDb();
    expect(isSeedBaseAplicado(db)).toBe(false);

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });

    expect(isSeedBaseAplicado(db)).toBe(true);
  });

  it('no re-siembra si el flag ya está presente', async () => {
    const db = createTestDb();

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    const roles1 = (db as any).$client.prepare('SELECT COUNT(*) c FROM rol').get().c;

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    const roles2 = (db as any).$client.prepare('SELECT COUNT(*) c FROM rol').get().c;

    expect(roles2).toBe(roles1);
  });
});

describe('runStartup — permisos nuevos en instalaciones existentes', () => {
  const sql = (db: any) => (db as any).$client;

  /**
   * Simula una instalacion ya inicializada a la que le falta un permiso nuevo:
   * arranca una vez (queda seed_base_aplicado=true) y despues se le borra el
   * permiso, como si la version instalada fuera anterior a que ese permiso existiera.
   */
  async function instalacionExistenteSin(codigo: string) {
    const db = createTestDb();
    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    expect(isSeedBaseAplicado(db)).toBe(true);

    const permisoId = sql(db).prepare('SELECT id FROM permiso WHERE codigo = ?').get(codigo)?.id;
    expect(permisoId, `el permiso ${codigo} deberia existir tras el primer arranque`).toBeTruthy();
    sql(db).prepare('DELETE FROM rol_permiso WHERE permiso_id = ?').run(permisoId);
    sql(db).prepare('DELETE FROM permiso WHERE id = ?').run(permisoId);

    return db;
  }

  it('re-siembra un permiso faltante en un arranque posterior', async () => {
    const db = await instalacionExistenteSin('remito.crear');
    expect(sql(db).prepare("SELECT COUNT(*) c FROM permiso WHERE codigo = 'remito.crear'").get().c).toBe(0);

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });

    expect(sql(db).prepare("SELECT COUNT(*) c FROM permiso WHERE codigo = 'remito.crear'").get().c).toBe(1);
  });

  it('otorga el permiso re-sembrado a ambos roles', async () => {
    const db = await instalacionExistenteSin('remito.crear');

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });

    const otorgados = sql(db).prepare(`
      SELECT COUNT(*) c FROM rol_permiso rp
      JOIN permiso p ON p.id = rp.permiso_id
      WHERE p.codigo = 'remito.crear'
    `).get().c;
    const roles = sql(db).prepare('SELECT COUNT(*) c FROM rol').get().c;
    expect(otorgados).toBe(roles);
  });

  it('siembra los sinónimos y los re-siembra en un arranque posterior si la base ya inicializada los tiene vacíos (ADR-067)', async () => {
    const db = createTestDb();
    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    expect(sql(db).prepare('SELECT COUNT(*) c FROM sinonimo').get().c).toBeGreaterThan(100);

    // Simula una base creada antes de la feature: la tabla existe (migración) pero vacía,
    // y seed_base_aplicado ya está en true (el first-run guard no vuelve a correr).
    sql(db).prepare('DELETE FROM sinonimo').run();
    expect(sql(db).prepare('SELECT COUNT(*) c FROM sinonimo').get().c).toBe(0);
    expect(isSeedBaseAplicado(db)).toBe(true);

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    expect(sql(db).prepare('SELECT COUNT(*) c FROM sinonimo').get().c).toBeGreaterThan(100);
  });

  it('no duplica permisos ni roles al arrancar varias veces', async () => {
    const db = createTestDb();
    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    const snap = () => ({
      permisos: sql(db).prepare('SELECT COUNT(*) c FROM permiso').get().c,
      roles:    sql(db).prepare('SELECT COUNT(*) c FROM rol').get().c,
      rp:       sql(db).prepare('SELECT COUNT(*) c FROM rol_permiso').get().c,
      usuarios: sql(db).prepare('SELECT COUNT(*) c FROM usuario').get().c,
    });
    const antes = snap();

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });

    expect(snap()).toEqual(antes);
  });

  it('no recrea el usuario admin si ya hay usuarios', async () => {
    const db = createTestDb();
    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });
    sql(db).prepare("UPDATE usuario SET nombre_usuario = 'jefe' WHERE nombre_usuario = 'admin'").run();

    await runStartup(db, { skipBackup: true, skipMigrations: true, geoCache: GEO_CACHE });

    expect(sql(db).prepare("SELECT COUNT(*) c FROM usuario WHERE nombre_usuario = 'admin'").get().c).toBe(0);
    expect(sql(db).prepare('SELECT COUNT(*) c FROM usuario').get().c).toBe(1);
  });
});
