// packages/client/src/main/db/reconcile.ts
import type Database from 'better-sqlite3';

/**
 * Repara drift de esquema producido por migraciones insertadas fuera de orden.
 *
 * La migración `0036_sustitutos_equivalencia` se agregó en el medio de una secuencia ya
 * publicada, con un timestamp (`when`) menor al watermark que las bases ya actualizadas
 * tenían registrado en `__drizzle_migrations`. El migrador de Drizzle sólo aplica entradas
 * con `when > max(created_at)` registrado, así que en esas bases 0036 se saltea para siempre:
 * quedan sin la columna `producto.discontinuado`, sin la tabla `producto_equivalencia` y sin
 * el flag `sustitutos_habilitado`. Como `productoGetHandler` selecciona todas las columnas del
 * schema (`getTableColumns`, incluye `discontinuado`), la query falla con "no such column" y el
 * detalle de producto mostraba "Producto no encontrado".
 *
 * Esta función reaplica esos objetos de forma **idempotente** después de `migrate()`. Es no-op
 * en bases sanas o nuevas (donde 0036 sí corrió). SQLite no soporta `ADD COLUMN IF NOT EXISTS`
 * en SQL puro, por eso el chequeo va en código y no en un archivo de migración.
 *
 * Al agregar acá una reparación, mantenerla estrictamente idempotente y acotada a objetos que
 * un `migrate()` en orden ya habría creado.
 */
export function reconcileSchema(sqlite: Database.Database): void {
  reconcile0036Sustitutos(sqlite);
}

function hasColumn(sqlite: Database.Database, table: string, column: string): boolean {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function hasTable(sqlite: Database.Database, name: string): boolean {
  return !!sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
}

function reconcile0036Sustitutos(sqlite: Database.Database): void {
  // Columna discontinuado en producto (misma definición que 0036).
  if (!hasColumn(sqlite, 'producto', 'discontinuado')) {
    sqlite.exec('ALTER TABLE `producto` ADD COLUMN `discontinuado` INTEGER NOT NULL DEFAULT 0');
  }

  // Tabla producto_equivalencia + índices (misma definición que 0036).
  if (!hasTable(sqlite, 'producto_equivalencia')) {
    sqlite.exec(`
      CREATE TABLE \`producto_equivalencia\` (
        \`id\`                       TEXT PRIMARY KEY NOT NULL,
        \`producto_id\`              TEXT NOT NULL,
        \`producto_relacionado_id\`  TEXT NOT NULL,
        \`tipo\`                     TEXT NOT NULL,
        \`nota\`                     TEXT,
        \`deleted_at\`               INTEGER,
        \`usuario_creacion_id\`      TEXT NOT NULL,
        \`fecha_creacion\`           INTEGER NOT NULL,
        \`version\`                  INTEGER NOT NULL DEFAULT 1,
        \`origin_id\`                TEXT NOT NULL,
        \`sync_state\`               TEXT NOT NULL DEFAULT 'pending',
        \`updated_at\`               INTEGER NOT NULL
      );
      CREATE INDEX \`idx_prod_equiv_producto\` ON \`producto_equivalencia\` (\`producto_id\`);
      CREATE INDEX \`idx_prod_equiv_relacionado\` ON \`producto_equivalencia\` (\`producto_relacionado_id\`);
      CREATE UNIQUE INDEX \`uq_prod_equiv_activa\` ON \`producto_equivalencia\` (\`producto_id\`, \`producto_relacionado_id\`, \`tipo\`) WHERE \`deleted_at\` IS NULL;
    `);
  }

  // Flag sustitutos_habilitado (default false). INSERT idempotente por PK `clave`.
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion) VALUES ('sustitutos_habilitado', 'false', 'bool', 'Sustitutos curados: equivalentes/reemplazos y flag discontinuado')",
    )
    .run();
}
