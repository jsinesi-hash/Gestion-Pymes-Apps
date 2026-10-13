// Apertura de la BD de Elaborados FUERA de Electron, para los scripts de seed (seed:base/seed:dev).
// No importa db/client.ts: ese módulo importa 'electron' y abre la BD de userData al cargarse.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { createDb, runMigrations } from '@core/db';
import * as schema from '../db/schema';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

/** `DB_PATH` si está definida; si no, la misma ruta que `app.getPath('userData')` de la app. */
export function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'elaborados-client', 'elaborados.db');
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
  const { db } = createDb(sqlite, schema);
  runMigrations(db, sqlite, MIGRATIONS_DIR);
  return db;
}

/** Vuelca el WAL al archivo principal para que los datos se vean desde otro proceso. */
export function checkpointDevDb(): void {
  if (_openSqlite) {
    const result = _openSqlite.pragma('wal_checkpoint(FULL)');
    console.log('[seed] WAL checkpoint:', JSON.stringify(result));
  }
}

export function closeDevDb(): void {
  _openSqlite?.close();
  _openSqlite = null;
}
