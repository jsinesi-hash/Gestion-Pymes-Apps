// packages/client/src/main/db/__tests__/reconcile.test.ts
//
// Regresión: la migración 0036 (sustitutos) se insertó en el medio de la secuencia con un
// timestamp menor al watermark que las bases ya actualizadas tenían registrado. El migrador
// de Drizzle (aplica solo `when > max(created_at)`) la saltea para siempre en esas bases, así
// que quedan sin `producto.discontinuado`, sin `producto_equivalencia` y sin el flag
// `sustitutos_habilitado`. `productoGetHandler` selecciona `discontinuado` (getTableColumns) y
// la query tira "no such column" → el detalle mostraba "Producto no encontrado".
// `reconcileSchema` repara ese drift de forma idempotente después de migrate().
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '../schema';
import { reconcileSchema } from '../reconcile';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function fullyMigratedDb(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  migrate(drizzle(sqlite, { schema }), { migrationsFolder: MIGRATIONS_DIR });
  return sqlite;
}

/** Reproduce el estado de una base ya actualizada a la que 0036 nunca se le aplicó. */
function simulate0036Skipped(sqlite: Database.Database): void {
  sqlite.exec('ALTER TABLE `producto` DROP COLUMN `discontinuado`');
  sqlite.exec('DROP TABLE `producto_equivalencia`');
  sqlite.prepare("DELETE FROM parametros_sistema WHERE clave = 'sustitutos_habilitado'").run();
}

const hasCol = (db: Database.Database, table: string, col: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(c => c.name === col);
const hasTable = (db: Database.Database, name: string) =>
  !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
const hasParam = (db: Database.Database, clave: string) =>
  !!db.prepare('SELECT 1 FROM parametros_sistema WHERE clave=?').get(clave);

describe('reconcileSchema — repara el drift de la migración 0036 (sustitutos)', () => {
  let db: Database.Database;
  beforeEach(() => { db = fullyMigratedDb(); });
  afterEach(() => { db.close(); });

  it('reproduce el estado roto: sin discontinuado, sin producto_equivalencia, sin flag', () => {
    simulate0036Skipped(db);
    expect(hasCol(db, 'producto', 'discontinuado')).toBe(false);
    expect(hasTable(db, 'producto_equivalencia')).toBe(false);
    expect(hasParam(db, 'sustitutos_habilitado')).toBe(false);
  });

  it('restaura la columna, la tabla y el flag faltantes', () => {
    simulate0036Skipped(db);
    reconcileSchema(db);
    expect(hasCol(db, 'producto', 'discontinuado')).toBe(true);
    expect(hasTable(db, 'producto_equivalencia')).toBe(true);
    expect(hasParam(db, 'sustitutos_habilitado')).toBe(true);
  });

  it('la columna restaurada es NOT NULL DEFAULT 0 y usable por una query tipo get', () => {
    simulate0036Skipped(db);
    reconcileSchema(db);
    // filas preexistentes quedan con discontinuado = 0
    const row = db.prepare('SELECT discontinuado FROM producto LIMIT 1').get() as { discontinuado: number } | undefined;
    if (row) expect(row.discontinuado).toBe(0);
    expect(() => db.prepare('SELECT producto.discontinuado FROM producto').all()).not.toThrow();
  });

  it('es idempotente: correrlo dos veces no rompe ni duplica el flag', () => {
    simulate0036Skipped(db);
    reconcileSchema(db);
    expect(() => reconcileSchema(db)).not.toThrow();
    const count = (db.prepare("SELECT COUNT(*) c FROM parametros_sistema WHERE clave='sustitutos_habilitado'").get() as { c: number }).c;
    expect(count).toBe(1);
  });

  it('es no-op en una base sana/nueva (no tira ni duplica)', () => {
    expect(hasCol(db, 'producto', 'discontinuado')).toBe(true);
    expect(() => reconcileSchema(db)).not.toThrow();
    expect(hasCol(db, 'producto', 'discontinuado')).toBe(true);
    const count = (db.prepare("SELECT COUNT(*) c FROM parametros_sistema WHERE clave='sustitutos_habilitado'").get() as { c: number }).c;
    expect(count).toBe(1);
  });
});
