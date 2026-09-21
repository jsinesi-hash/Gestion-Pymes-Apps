// packages/client/src/main/db/__tests__/r3_schema.test.ts
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
    const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) db.exec(stmt);
  }
}

const NOW = `strftime('%s','now') * 1000`;
const SYNC = `1, 'T1', 'pending', ${NOW}`;

function insertCategoria(db: Database.Database, id: string) {
  db.prepare(`
    INSERT OR IGNORE INTO categoria (id, nombre, activo, version, origin_id, sync_state, updated_at,
      usuario_creacion_id, fecha_creacion)
    VALUES ('${id}', 'Cat', 1, ${SYNC}, 'system', ${NOW})
  `).run();
}

function insertProducto(db: Database.Database, id: string, categoriaId = 'cat1') {
  insertCategoria(db, categoriaId);
  db.prepare(`
    INSERT INTO producto (id, sku, sku_secuencial, nombre_corto, nombre_largo,
      unidad_venta, precio_costo_promedio, precio_venta_lista,
      categoria_id, activo, version, origin_id, sync_state, updated_at,
      usuario_creacion_id, fecha_creacion)
    VALUES ('${id}', 'P-000000${id.slice(-1)}-0', 1, '${id}', 'Producto',
      'unidad', 0, 0, '${categoriaId}', 1, ${SYNC}, 'system', ${NOW})
  `).run();
}

function insertProveedor(db: Database.Database, id: string) {
  db.prepare(`
    INSERT INTO proveedor (id, tipo_documento, numero_documento, razon_social,
      condicion_fiscal, activo, version, origin_id, sync_state, updated_at,
      usuario_creacion_id, fecha_creacion)
    VALUES ('${id}', 'CUIT', '2099999999${id.slice(-1)}', 'Proveedor ${id}',
      'RI', 1, ${SYNC}, 'system', ${NOW})
  `).run();
}

function insertRolYUsuario(db: Database.Database, usuarioId: string, rolId = 'rol1') {
  db.prepare(`
    INSERT OR IGNORE INTO rol (id, nombre, es_sistema, activo, version, origin_id, sync_state, updated_at)
    VALUES ('${rolId}', 'Supervisor', 1, 1, ${SYNC})
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO usuario (id, nombre_usuario, nombre_completo, hash_password,
      rol_id, activo, version, origin_id, sync_state, updated_at,
      usuario_creacion_id, fecha_creacion)
    VALUES ('${usuarioId}', '${usuarioId}', 'Test User', 'hash', '${rolId}',
      1, ${SYNC}, 'system', ${NOW})
  `).run();
}

function insertOrdenCompra(db: Database.Database, id: string, proveedorId: string, usuarioId: string) {
  db.prepare(`
    INSERT INTO orden_compra (id, numero_interno, proveedor_id, tipo, estado,
      fecha, subtotal_centavos, importe_iva_centavos, total_centavos,
      usuario_id, usuario_creacion_id, fecha_creacion,
      version, origin_id, sync_state, updated_at)
    VALUES ('${id}', 'OC-C1-0000${id}', '${proveedorId}', 'manual', 'borrador',
      ${NOW}, 0, 0, 0, '${usuarioId}', '${usuarioId}', ${NOW},
      ${SYNC})
  `).run();
}

function insertRecepcion(db: Database.Database, id: string, ocId: string, usuarioId: string) {
  db.prepare(`
    INSERT INTO recepcion (id, orden_compra_id, fecha, usuario_id,
      version, origin_id, sync_state, updated_at)
    VALUES ('${id}', '${ocId}', ${NOW}, '${usuarioId}', ${SYNC})
  `).run();
}

function insertItemOc(db: Database.Database, id: string, ocId: string, productoId: string) {
  db.prepare(`
    INSERT INTO item_oc (id, orden_compra_id, producto_id, descripcion,
      cantidad_pedida, cantidad_recibida, costo_unitario_centavos, alicuota_iva,
      subtotal_centavos, version, origin_id, sync_state, updated_at)
    VALUES ('${id}', '${ocId}', '${productoId}', 'snap',
      10.0, 0, 1000, 21.0, 10000, ${SYNC})
  `).run();
}

function insertCliente(db: Database.Database, id: string) {
  db.prepare(`
    INSERT INTO cliente (id, tipo_documento, numero_documento, nombre, apellido,
      condicion_fiscal, habilita_cuenta_corriente, activo,
      version, origin_id, sync_state, updated_at,
      usuario_creacion_id, fecha_creacion)
    VALUES ('${id}', 'CUIT', '2088888888${id.slice(-1)}', 'Cliente ${id}', '(revisar)',
      'RI', 0, 1, ${SYNC}, 'system', ${NOW})
  `).run();
}

function insertCuentaCorriente(db: Database.Database, id: string, clienteId: string) {
  db.prepare(`
    INSERT INTO cuenta_corriente_cliente (id, cliente_id, saldo_centavos,
      limite_credito_centavos, activo, version, origin_id, sync_state, updated_at)
    VALUES ('${id}', '${clienteId}', 0, 100000, 1, ${SYNC})
  `).run();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('R3 schema — tablas de compras y crédito', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    applyMigrations(db);
  });

  afterEach(() => db.close());

  // ── 1. Tablas creadas ──────────────────────────────────────────────────────

  it('crea todas las tablas de R3', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r: any) => r.name);

    const r3 = [
      'comprobante_compra',
      'cuenta_corriente_cliente',
      'item_oc',
      'movimiento_cuenta_corriente',
      'orden_compra',
      'producto_proveedor',
      'recepcion',
      'recepcion_detalle',
    ];
    for (const t of r3) expect(tables, `falta tabla: ${t}`).toContain(t);
  });

  // ── 2. producto_proveedor ──────────────────────────────────────────────────

  describe('producto_proveedor', () => {
    it('rechaza FK producto_id inválido', () => {
      insertProveedor(db, 'prov1');
      expect(() => db.prepare(`
        INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
          preferido, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('pp1', 'prod-inexistente', 'prov1', 1000, 0, ${SYNC}, 'system', ${NOW})
      `).run()).toThrow();
    });

    it('rechaza FK proveedor_id inválido', () => {
      insertProducto(db, 'prod1');
      expect(() => db.prepare(`
        INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
          preferido, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('pp1', 'prod1', 'prov-inexistente', 1000, 0, ${SYNC}, 'system', ${NOW})
      `).run()).toThrow();
    });

    it('rechaza par (producto_id, proveedor_id) duplicado', () => {
      insertProducto(db, 'prod1');
      insertProveedor(db, 'prov1');
      const ins = db.prepare(`
        INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
          preferido, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES (?, 'prod1', 'prov1', 1000, 0, ${SYNC}, 'system', ${NOW})
      `);
      ins.run('pp1');
      expect(() => ins.run('pp2')).toThrow();
    });

    it('permite un solo preferido=1 por producto', () => {
      insertProducto(db, 'prod1');
      insertProveedor(db, 'prov1');
      insertProveedor(db, 'prov2');
      db.prepare(`
        INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
          preferido, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('pp1', 'prod1', 'prov1', 1000, 1, ${SYNC}, 'system', ${NOW})
      `).run();
      expect(() => db.prepare(`
        INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
          preferido, version, origin_id, sync_state, updated_at,
          usuario_creacion_id, fecha_creacion)
        VALUES ('pp2', 'prod1', 'prov2', 1500, 1, ${SYNC}, 'system', ${NOW})
      `).run()).toThrow();
    });

    it('permite múltiples preferido=0 por producto', () => {
      insertProducto(db, 'prod1');
      insertProveedor(db, 'prov1');
      insertProveedor(db, 'prov2');
      expect(() => {
        db.prepare(`
          INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
            preferido, version, origin_id, sync_state, updated_at,
            usuario_creacion_id, fecha_creacion)
          VALUES ('pp1', 'prod1', 'prov1', 1000, 0, ${SYNC}, 'system', ${NOW})
        `).run();
        db.prepare(`
          INSERT INTO producto_proveedor (id, producto_id, proveedor_id, costo_centavos,
            preferido, version, origin_id, sync_state, updated_at,
            usuario_creacion_id, fecha_creacion)
          VALUES ('pp2', 'prod1', 'prov2', 1500, 0, ${SYNC}, 'system', ${NOW})
        `).run();
      }).not.toThrow();
    });
  });

  // ── 3. orden_compra e item_oc ──────────────────────────────────────────────

  describe('orden_compra', () => {
    it('numero_interno es único', () => {
      insertProveedor(db, 'prov1');
      insertRolYUsuario(db, 'u1');
      insertOrdenCompra(db, 'oc1', 'prov1', 'u1');
      expect(() => db.prepare(`
        INSERT INTO orden_compra (id, numero_interno, proveedor_id, tipo, estado,
          fecha, subtotal_centavos, importe_iva_centavos, total_centavos,
          usuario_id, usuario_creacion_id, fecha_creacion,
          version, origin_id, sync_state, updated_at)
        VALUES ('oc2', 'OC-C1-0000oc1', 'prov1', 'manual', 'borrador',
          ${NOW}, 0, 0, 0, 'u1', 'u1', ${NOW}, ${SYNC})
      `).run()).toThrow();
    });

    it('rechaza FK proveedor_id inválido', () => {
      insertRolYUsuario(db, 'u1');
      expect(() => db.prepare(`
        INSERT INTO orden_compra (id, numero_interno, proveedor_id, tipo, estado,
          fecha, subtotal_centavos, importe_iva_centavos, total_centavos,
          usuario_id, usuario_creacion_id, fecha_creacion,
          version, origin_id, sync_state, updated_at)
        VALUES ('oc1', 'OC-C1-000001', 'prov-inexistente', 'manual', 'borrador',
          ${NOW}, 0, 0, 0, 'u1', 'u1', ${NOW}, ${SYNC})
      `).run()).toThrow();
    });
  });

  describe('item_oc', () => {
    it('rechaza FK orden_compra_id inválido', () => {
      insertProducto(db, 'prod1');
      expect(() => db.prepare(`
        INSERT INTO item_oc (id, orden_compra_id, producto_id, descripcion,
          cantidad_pedida, cantidad_recibida, costo_unitario_centavos, alicuota_iva,
          subtotal_centavos, version, origin_id, sync_state, updated_at)
        VALUES ('item1', 'oc-inexistente', 'prod1', 'snap',
          10, 0, 1000, 21, 10000, ${SYNC})
      `).run()).toThrow();
    });

    it('rechaza FK producto_id inválido', () => {
      insertProveedor(db, 'prov1');
      insertRolYUsuario(db, 'u1');
      insertOrdenCompra(db, 'oc1', 'prov1', 'u1');
      expect(() => db.prepare(`
        INSERT INTO item_oc (id, orden_compra_id, producto_id, descripcion,
          cantidad_pedida, cantidad_recibida, costo_unitario_centavos, alicuota_iva,
          subtotal_centavos, version, origin_id, sync_state, updated_at)
        VALUES ('item1', 'oc1', 'prod-inexistente', 'snap',
          10, 0, 1000, 21, 10000, ${SYNC})
      `).run()).toThrow();
    });
  });

  // ── 4. recepcion y recepcion_detalle ───────────────────────────────────────

  describe('recepcion', () => {
    it('rechaza FK orden_compra_id inválido', () => {
      insertRolYUsuario(db, 'u1');
      expect(() => db.prepare(`
        INSERT INTO recepcion (id, orden_compra_id, fecha, usuario_id,
          version, origin_id, sync_state, updated_at)
        VALUES ('r1', 'oc-inexistente', ${NOW}, 'u1', ${SYNC})
      `).run()).toThrow();
    });
  });

  describe('recepcion_detalle', () => {
    it('rechaza FK recepcion_id inválido', () => {
      expect(() => db.prepare(`
        INSERT INTO recepcion_detalle (id, recepcion_id, item_oc_id, cantidad_recibida,
          version, origin_id, sync_state, updated_at)
        VALUES ('rd1', 'rec-inexistente', 'item-inexistente', 5, ${SYNC})
      `).run()).toThrow();
    });

    it('rechaza FK item_oc_id inválido', () => {
      insertProveedor(db, 'prov1');
      insertRolYUsuario(db, 'u1');
      insertOrdenCompra(db, 'oc1', 'prov1', 'u1');
      insertRecepcion(db, 'rec1', 'oc1', 'u1');
      expect(() => db.prepare(`
        INSERT INTO recepcion_detalle (id, recepcion_id, item_oc_id, cantidad_recibida,
          version, origin_id, sync_state, updated_at)
        VALUES ('rd1', 'rec1', 'item-inexistente', 5, ${SYNC})
      `).run()).toThrow();
    });

    it('admite costo_unitario_real_centavos nulo (P3.5: confirmación explícita)', () => {
      insertProveedor(db, 'prov1');
      insertRolYUsuario(db, 'u1');
      insertProducto(db, 'prod1');
      insertOrdenCompra(db, 'oc1', 'prov1', 'u1');
      insertItemOc(db, 'item1', 'oc1', 'prod1');
      insertRecepcion(db, 'rec1', 'oc1', 'u1');
      expect(() => db.prepare(`
        INSERT INTO recepcion_detalle (id, recepcion_id, item_oc_id, cantidad_recibida,
          costo_unitario_real_centavos, version, origin_id, sync_state, updated_at)
        VALUES ('rd1', 'rec1', 'item1', 5, NULL, ${SYNC})
      `).run()).not.toThrow();
    });
  });

  // ── 5. cuenta_corriente_cliente y movimientos ──────────────────────────────

  describe('cuenta_corriente_cliente', () => {
    it('cliente_id es único (una cuenta por cliente)', () => {
      insertCliente(db, 'cli1');
      insertCuentaCorriente(db, 'ccc1', 'cli1');
      expect(() => insertCuentaCorriente(db, 'ccc2', 'cli1')).toThrow();
    });

    it('rechaza FK cliente_id inválido', () => {
      expect(() => db.prepare(`
        INSERT INTO cuenta_corriente_cliente (id, cliente_id, saldo_centavos,
          limite_credito_centavos, activo, version, origin_id, sync_state, updated_at)
        VALUES ('ccc1', 'cli-inexistente', 0, 100000, 1, ${SYNC})
      `).run()).toThrow();
    });
  });

  describe('movimiento_cuenta_corriente', () => {
    it('rechaza FK cuenta_id inválido', () => {
      insertRolYUsuario(db, 'u1');
      expect(() => db.prepare(`
        INSERT INTO movimiento_cuenta_corriente (id, cuenta_id, tipo, motivo,
          monto_centavos, saldo_resultante_centavos, usuario_id, fecha,
          version, origin_id, sync_state, updated_at)
        VALUES ('mcc1', 'cuenta-inexistente', 'cargo', 'venta_credito',
          50000, 50000, 'u1', ${NOW}, ${SYNC})
      `).run()).toThrow();
    });

    it('acepta tipo cargo y pago', () => {
      insertCliente(db, 'cli1');
      insertCuentaCorriente(db, 'ccc1', 'cli1');
      insertRolYUsuario(db, 'u1');
      expect(() => {
        db.prepare(`
          INSERT INTO movimiento_cuenta_corriente (id, cuenta_id, tipo, motivo,
            monto_centavos, saldo_resultante_centavos, usuario_id, fecha,
            version, origin_id, sync_state, updated_at)
          VALUES ('mcc1', 'ccc1', 'cargo', 'venta_credito',
            50000, 50000, 'u1', ${NOW}, ${SYNC})
        `).run();
        db.prepare(`
          INSERT INTO movimiento_cuenta_corriente (id, cuenta_id, tipo, motivo,
            monto_centavos, saldo_resultante_centavos, usuario_id, fecha,
            version, origin_id, sync_state, updated_at)
          VALUES ('mcc2', 'ccc1', 'pago', 'cobro',
            50000, 0, 'u1', ${NOW}, ${SYNC})
        `).run();
      }).not.toThrow();
    });
  });

  // ── 6. parametros_sistema ──────────────────────────────────────────────────

  it('inserta oc_correlativo_C1 en parametros_sistema', () => {
    const row = db.prepare(
      `SELECT valor FROM parametros_sistema WHERE clave = 'oc_correlativo_C1'`
    ).get() as any;
    expect(row?.valor).toBe('0');
  });
});
