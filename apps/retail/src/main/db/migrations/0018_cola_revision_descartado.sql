-- Actualizar CHECK constraint para permitir estado 'descartado' con producto_id NULL
CREATE TABLE `importacion_costo_proveedor_detalle_new` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `importacion_id`          TEXT NOT NULL REFERENCES `importacion_costo_proveedor`(`id`),
    `producto_id`             TEXT REFERENCES `producto`(`id`),
    `costo_anterior_centavos` INTEGER,
    `costo_nuevo_centavos`    INTEGER,
    `fila_original`           TEXT,
    `estado`                  TEXT NOT NULL DEFAULT 'matched',
    `matched_by`              TEXT,
    `resuelto_por_usuario_id` TEXT,
    `fecha_resolucion`        INTEGER,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL,
    CHECK (
        (estado IN ('sin_matchear', 'descartado') AND producto_id IS NULL) OR
        (estado NOT IN ('sin_matchear', 'descartado') AND producto_id IS NOT NULL)
    )
);
--> statement-breakpoint
DROP INDEX IF EXISTS `icp_detalle_estado_idx`;
--> statement-breakpoint
CREATE INDEX `icp_detalle_estado_idx`
    ON `importacion_costo_proveedor_detalle_new` (`estado`);
--> statement-breakpoint
INSERT INTO `importacion_costo_proveedor_detalle_new`
    SELECT `id`, `importacion_id`, `producto_id`, `costo_anterior_centavos`, `costo_nuevo_centavos`,
           `fila_original`, `estado`, `matched_by`, `resuelto_por_usuario_id`, `fecha_resolucion`,
           `version`, `origin_id`, `sync_state`, `updated_at`
    FROM `importacion_costo_proveedor_detalle`;
--> statement-breakpoint
DROP TABLE `importacion_costo_proveedor_detalle`;
--> statement-breakpoint
ALTER TABLE `importacion_costo_proveedor_detalle_new`
    RENAME TO `importacion_costo_proveedor_detalle`;
