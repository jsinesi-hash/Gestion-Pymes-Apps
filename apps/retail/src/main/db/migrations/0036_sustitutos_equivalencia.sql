-- Sustitutos curados: relaciones producto↔producto (equivalente | reemplazo) + flag discontinuado.
-- Aditiva. La tabla sigue el patrón de producto_proveedor (soft-delete por deleted_at).
ALTER TABLE `producto` ADD COLUMN `discontinuado` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `producto_equivalencia` (
    `id`                    TEXT PRIMARY KEY NOT NULL,
    `producto_id`           TEXT NOT NULL,
    `producto_relacionado_id` TEXT NOT NULL,
    `tipo`                  TEXT NOT NULL,
    `nota`                  TEXT,
    `deleted_at`            INTEGER,
    `usuario_creacion_id`   TEXT NOT NULL,
    `fecha_creacion`        INTEGER NOT NULL,
    `version`               INTEGER NOT NULL DEFAULT 1,
    `origin_id`             TEXT NOT NULL,
    `sync_state`            TEXT NOT NULL DEFAULT 'pending',
    `updated_at`            INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_prod_equiv_producto` ON `producto_equivalencia` (`producto_id`);
--> statement-breakpoint
CREATE INDEX `idx_prod_equiv_relacionado` ON `producto_equivalencia` (`producto_relacionado_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prod_equiv_activa` ON `producto_equivalencia` (`producto_id`, `producto_relacionado_id`, `tipo`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('sustitutos_habilitado', 'false', 'bool', 'Sustitutos curados: equivalentes/reemplazos y flag discontinuado');
