import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'ferreteria-client', 'ferreteria.db');
}

let _openSqlite: Database.Database | null = null;

export function openDevDb() {
  const dbPath = resolveDbPath();
  console.log(`[seed] DB: ${dbPath}`);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  _openSqlite = sqlite;
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'db', 'migrations') });
  return db;
}

/** Call after all seed work to flush WAL to main DB file so data survives across processes. */
export function checkpointDevDb(): void {
  if (_openSqlite) {
    const result = _openSqlite.pragma('wal_checkpoint(FULL)');
    console.log('[seed] WAL checkpoint:', JSON.stringify(result));
  }
}
