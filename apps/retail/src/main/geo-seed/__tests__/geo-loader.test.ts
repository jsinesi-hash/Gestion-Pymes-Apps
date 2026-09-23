import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { runGeoSeedOffline } from '@core/main';

const GEO_CACHE = path.resolve(__dirname, '../../../../../../packages/core-main/geo-cache');

describe('runGeoSeedOffline', () => {
  it('puebla provincia/departamento/localidad desde cache', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.exec(`
      CREATE TABLE provincia (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL);
      CREATE TABLE departamento (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL, provincia_id TEXT NOT NULL);
      CREATE TABLE localidad (
        id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL,
        provincia_id TEXT NOT NULL, departamento_id TEXT, codigo_postal TEXT
      );
    `);

    await runGeoSeedOffline(sqlite, GEO_CACHE);

    const provCount = (sqlite.prepare('SELECT COUNT(*) c FROM provincia').get() as { c: number }).c;
    const locCount  = (sqlite.prepare('SELECT COUNT(*) c FROM localidad').get() as { c: number }).c;
    expect(provCount).toBeGreaterThanOrEqual(24);
    expect(locCount).toBeGreaterThan(1000);
    sqlite.close();
  });

  it('es idempotente — segunda llamada no duplica ni lanza', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.exec(`
      CREATE TABLE provincia (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL);
      CREATE TABLE departamento (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL, provincia_id TEXT NOT NULL);
      CREATE TABLE localidad (
        id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_norm TEXT NOT NULL,
        provincia_id TEXT NOT NULL, departamento_id TEXT, codigo_postal TEXT
      );
    `);

    await runGeoSeedOffline(sqlite, GEO_CACHE);
    const first  = (sqlite.prepare('SELECT COUNT(*) c FROM localidad').get() as { c: number }).c;
    await runGeoSeedOffline(sqlite, GEO_CACHE);
    const second = (sqlite.prepare('SELECT COUNT(*) c FROM localidad').get() as { c: number }).c;
    expect(second).toBe(first);
    sqlite.close();
  });
});
