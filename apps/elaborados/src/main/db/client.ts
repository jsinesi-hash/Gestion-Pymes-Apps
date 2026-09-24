// apps/elaborados/src/main/db/client.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createDb, runMigrations as runCoreMigrations } from '@core/db';
import * as schema from './schema';

export const DB_PATH = path.join(app.getPath('userData'), 'elaborados.db');

const sqlite = new Database(DB_PATH);
export const db = createDb(sqlite, schema).db;

export const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function runMigrations(): void {
  runCoreMigrations(db, sqlite, MIGRATIONS_DIR);
}

export function hasPendingMigrations(): boolean {
  if (!fs.existsSync(DB_PATH)) return false;

  const sqlite2 = new Database(DB_PATH);
  try {
    const tableExists = sqlite2.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
    ).get();
    if (!tableExists) return false;

    const applied = (sqlite2.prepare(
      'SELECT COUNT(*) as c FROM __drizzle_migrations'
    ).get() as { c: number }).c;

    const migrationsDir = MIGRATIONS_DIR;
    if (!fs.existsSync(migrationsDir)) return false;

    const total = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith('.down.sql')).length;

    return applied < total;
  } finally {
    sqlite2.close();
  }
}
