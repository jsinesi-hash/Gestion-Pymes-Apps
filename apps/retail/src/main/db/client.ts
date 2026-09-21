// packages/client/src/main/db/client.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createDb, runMigrations as runCoreMigrations } from '@core/db';
import * as schema from './schema';
import { reconcileSchema } from './reconcile';

export const DB_PATH = path.join(app.getPath('userData'), 'ferreteria.db');

const sqlite = new Database(DB_PATH);
export const db = createDb(sqlite, schema).db;

export function runMigrations(): void {
  runCoreMigrations(db, sqlite, path.join(__dirname, 'migrations'));
  // Repara drift de migraciones aplicadas fuera de orden que migrate() no reaplica
  // por su watermark de timestamp (ver reconcile.ts). Idempotente; no-op en bases sanas.
  reconcileSchema(sqlite);
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

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return false;

    const total = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith('.down.sql')).length;

    return applied < total;
  } finally {
    sqlite2.close();
  }
}
