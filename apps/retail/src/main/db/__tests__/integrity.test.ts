// packages/client/src/main/db/__tests__/integrity.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function applyMigrations(db: Database.Database): void {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith('.down.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(Boolean);
    for (const stmt of statements) db.exec(stmt);
  }
}

describe('Referential integrity (FK ON)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('rejects producto with invalid categoria_id', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO producto (id, sku, sku_secuencial, nombre_corto, nombre_largo,
          unidad_venta, precio_costo_promedio, precio_venta_lista,
          categoria_id, activo, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('p1','P-0000001-9', 1, 'Tornillo','Tornillo 1"',
          'unidad', 0.0, 0.0,
          'cat-inexistente', 1, 1, 'terminal-1', 'pending',
          strftime('%s','now'), 'u1', strftime('%s','now'))
      `).run();
    }).toThrow();
  });

  it('accepts producto with valid categoria_id', () => {
    db.prepare(`
      INSERT INTO categoria (id, nombre, activo, version, origin_id, sync_state, updated_at,
        usuario_creacion_id, fecha_creacion)
      VALUES ('cat1', 'Tornillería', 1, 1, 'terminal-1', 'pending',
        strftime('%s','now'), 'u1', strftime('%s','now'))
    `).run();

    expect(() => {
      db.prepare(`
        INSERT INTO producto (id, sku, sku_secuencial, nombre_corto, nombre_largo,
          unidad_venta, precio_costo_promedio, precio_venta_lista,
          categoria_id, activo, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('p1','P-0000001-9', 1, 'Tornillo','Tornillo 1"',
          'unidad', 0.0, 0.0,
          'cat1', 1, 1, 'terminal-1', 'pending',
          strftime('%s','now'), 'u1', strftime('%s','now'))
      `).run();
    }).not.toThrow();
  });

  it('rejects movimiento_stock with invalid producto_id', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO movimiento_stock (id, producto_id, tipo, motivo, cantidad,
          stock_resultante, referencia_tipo, referencia_id, usuario_id, fecha,
          version, origin_id, sync_state, updated_at)
        VALUES ('ms1', 'prod-inexistente', 'entrada', 'inicial', 10, 10,
          'manual', 'ref1', 'u1', strftime('%s','now'),
          1, 'terminal-1', 'pending', strftime('%s','now'))
      `).run();
    }).toThrow();
  });

  it('enforces unique sku on producto', () => {
    db.prepare(`
      INSERT INTO categoria (id, nombre, activo, version, origin_id, sync_state, updated_at,
        usuario_creacion_id, fecha_creacion)
      VALUES ('cat1', 'Cat', 1, 1, 'terminal-1', 'pending',
        strftime('%s','now'), 'u1', strftime('%s','now'))
    `).run();

    const insert = db.prepare(`
      INSERT INTO producto (id, sku, sku_secuencial, nombre_corto, nombre_largo,
        unidad_venta, precio_costo_promedio, precio_venta_lista,
        categoria_id, activo, version, origin_id, sync_state, updated_at,
        usuario_creacion_id, fecha_creacion)
      VALUES (?, 'P-0000001-9', ?, ?, ?,
        'unidad', 0.0, 0.0,
        'cat1', 1, 1, 'terminal-1', 'pending',
        strftime('%s','now'), 'u1', strftime('%s','now'))
    `);
    insert.run('p1', 1, 'Prod1', 'Producto 1');
    expect(() => insert.run('p2', 2, 'Prod2', 'Producto 2')).toThrow();
  });

  it('enforces unique ubicacion codigo', () => {
    const insert = db.prepare(`
      INSERT INTO ubicacion (id, codigo, sector, estante, posicion, activo,
        version, origin_id, sync_state, updated_at,
        usuario_creacion_id, fecha_creacion)
      VALUES (?, 'A-01-01', 'A', '01', '01', 1,
        1, 'terminal-1', 'pending', strftime('%s','now'),
        'u1', strftime('%s','now'))
    `);
    insert.run('u1');
    expect(() => insert.run('u2')).toThrow();
  });

  it('rejects venta_detalle with invalid venta_id', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO venta_detalle (id, venta_id, producto_id, descripcion,
          cantidad, precio_unitario, descuento_linea, alicuota_iva, subtotal,
          version, origin_id, sync_state, updated_at)
        VALUES ('vd1', 'venta-inexistente', 'prod-inexistente',
          'Producto snap', 1.0, 100.0, 0.0, 21.0, 100.0,
          1, 'terminal-1', 'pending', strftime('%s','now'))
      `).run();
    }).toThrow();
  });

  it('rejects usuario with invalid rol_id', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO usuario (id, nombre_usuario, nombre_completo, hash_password,
          rol_id, activo, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('u1', 'operador1', 'Juan Pérez', 'hash123',
          'rol-inexistente', 1,
          1, 'terminal-1', 'pending', strftime('%s','now'),
          'system', strftime('%s','now'))
      `).run();
    }).toThrow();
  });
});
