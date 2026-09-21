// packages/core-db/src/factory.ts
import type * as BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export function createDb<TSchema extends Record<string, unknown>>(
  sqlite: BetterSqlite3.Database,
  schema: TSchema,
): { db: ReturnType<typeof drizzle<TSchema>>; sqlite: BetterSqlite3.Database } {
  sqlite.pragma('journal_mode = WAL');   // no-op en :memory:
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// migrate() envuelve todo en un BEGIN/COMMIT y PRAGMA foreign_keys es no-op dentro de una
// transacción; hay que apagarlo ANTES o una migración que recree una tabla con FK entrante
// (ej. ADR-050 recrea `cliente`) falla al COMMIT en bases con datos reales.
export function runMigrations(
  db: ReturnType<typeof drizzle>,
  sqlite: BetterSqlite3.Database,
  migrationsFolder: string,
): void {
  sqlite.pragma('foreign_keys = OFF');
  try {
    migrate(db, { migrationsFolder });
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}
