import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../../db/schema';
import { runSeed } from '../../auth/seed';
import { loginHandler } from '../auth';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // migrate() crea __drizzle_migrations y aplica todas las migraciones
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

export function setupDb() {
  const db = createTestDb();
  runSeed(db);
  return db;
}

export function loginAsAdmin(db: ReturnType<typeof setupDb>) {
  return loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR
}

export { clearSession } from '../../auth/session';
