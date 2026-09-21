// packages/client/src/main/db/client.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import { reconcileSchema } from './reconcile';

export const DB_PATH = path.join(app.getPath('userData'), 'ferreteria.db');

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  // Drizzle envuelve todas las migraciones pendientes en un único BEGIN/COMMIT, y
  // `PRAGMA foreign_keys` no puede cambiarse dentro de una transacción (es un no-op
  // silencioso de SQLite) — hay que desactivarlo ANTES de llamar a migrate(). Sin esto,
  // cualquier migración que recree una tabla referenciada por FK (ej. ADR-050 recrea
  // `cliente`, referenciada por `venta`/`presupuesto`/`cuenta_corriente_cliente`) falla
  // con "FOREIGN KEY constraint failed" en cualquier base con datos reales — no se
  // detecta en tests porque las migraciones corren ahí sobre una base vacía.
  // `PRAGMA defer_foreign_keys=TRUE` dentro del propio archivo de migración no alcanza:
  // en la práctica el chequeo diferido igual falla al hacer COMMIT.
  sqlite.pragma('foreign_keys = OFF');
  try {
    migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
  // Repara drift de migraciones aplicadas fuera de orden que `migrate()` no reaplica
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
