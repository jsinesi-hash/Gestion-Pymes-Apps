import Database from 'better-sqlite3';
import path from 'node:path';
import { createDb, runMigrations } from '@core/db';
import * as schema from '../../db/schema';
import { runSeed } from '../../auth/seed';
import { loginHandler } from '../auth';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
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

export { clearSession } from '@core/main';
