// packages/client/src/main/db/__tests__/migration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const UP_SQL = path.join(MIGRATIONS_DIR, '0001_r1_schema.sql');
const DOWN_SQL = path.join(MIGRATIONS_DIR, '0001_r1_schema.down.sql');

function readSql(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function execScript(db: Database.Database, sql: string): void {
  // split on "--> statement-breakpoint" que drizzle-kit inserta
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    db.exec(stmt);
  }
}

describe('Migration 0001_r1_schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
  });

  it('applies UP migration without errors', () => {
    const sql = readSql(UP_SQL);
    expect(() => execScript(db, sql)).not.toThrow();
  });

  it('creates all 21 expected tables', () => {
    execScript(db, readSql(UP_SQL));
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r: any) => r.name);

    const expected = [
      'caja',
      'categoria',
      'cliente',
      'comprobante',
      'existencias',
      'impuesto',
      'lista_precio',
      'lista_precio_detalle',
      'marca',
      'movimiento_caja',
      'movimiento_stock',
      'permiso',
      'producto',
      'rol',
      'rol_permiso',
      'ubicacion',
      'usuario',
      'usuario_preferencias',
      'venta',
      'venta_detalle',
      'proveedor',
    ];
    for (const t of expected) {
      expect(tables).toContain(t);
    }
  });

  it('applies DOWN migration after UP without errors', () => {
    execScript(db, readSql(UP_SQL));
    const downSql = readSql(DOWN_SQL);
    expect(() => db.exec(downSql)).not.toThrow();
  });

  it('leaves no domain tables after DOWN', () => {
    execScript(db, readSql(UP_SQL));
    db.exec(readSql(DOWN_SQL));
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__drizzle%'`)
      .all()
      .map((r: any) => r.name);
    expect(tables).toHaveLength(0);
  });
});
