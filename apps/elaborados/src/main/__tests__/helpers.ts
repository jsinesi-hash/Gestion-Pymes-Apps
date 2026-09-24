import Database from 'better-sqlite3';
import path from 'node:path';
import { createDb, runMigrations } from '@core/db';
import { runSeed, loginHandler } from '@core/main';
import * as schema from '../db/schema';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../auth/seed';

export const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  return db;
}

export function setupDb() {
  const db = createTestDb();
  runSeed(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  return db;
}

export const loginAsAdmin = (db: ReturnType<typeof setupDb>) =>
  loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' }); // NOSONAR

export { clearSession } from '@core/main';
