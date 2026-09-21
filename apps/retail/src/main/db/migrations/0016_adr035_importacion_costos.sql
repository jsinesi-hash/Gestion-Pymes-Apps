-- ADR-035: config de mapeo de columnas por proveedor (1:1 con proveedor)
CREATE TABLE `proveedor_importacion_config` (
    `id`                       TEXT PRIMARY KEY NOT NULL,
    `proveedor_id`             TEXT NOT NULL UNIQUE REFERENCES `proveedor`(`id`),
    `formato_archivo`          TEXT NOT NULL DEFAULT 'csv',
    `delimitador`              TEXT,
    `fila_encabezado`          INTEGER NOT NULL DEFAULT 1,
    `columna_costo`            TEXT NOT NULL,
    `columna_codigo_proveedor` TEXT NOT NULL,
    `columna_gtin`             TEXT,
    `usuario_creacion_id`      TEXT NOT NULL,
    `fecha_creacion`           INTEGER NOT NULL,
    `version`                  INTEGER NOT NULL DEFAULT 1,
    `origin_id`                TEXT NOT NULL,
    `sync_state`               TEXT NOT NULL DEFAULT 'pending',
    `updated_at`               INTEGER NOT NULL
);
--> statement-breakpoint

-- ADR-035: recrear importacion_costo_proveedor_detalle con:
--   producto_id nullable (filas sin match no tienen producto asignado aún)
--   columnas de trazabilidad ADR-035
--   CHECK constraint estado/producto_id consistency (al final, después de todas las columnas)
--   índice en estado para la cola de revisión
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
        (estado = 'sin_matchear' AND producto_id IS NULL) OR
        (estado != 'sin_matchear' AND producto_id IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE INDEX `icp_detalle_estado_idx`
    ON `importacion_costo_proveedor_detalle_new` (`estado`);
--> statement-breakpoint
INSERT INTO `importacion_costo_proveedor_detalle_new`
    (`id`, `importacion_id`, `producto_id`, `costo_anterior_centavos`, `costo_nuevo_centavos`,
     `fila_original`, `estado`, `matched_by`, `resuelto_por_usuario_id`, `fecha_resolucion`,
     `version`, `origin_id`, `sync_state`, `updated_at`)
SELECT `id`, `importacion_id`, `producto_id`, `costo_anterior_centavos`, `costo_nuevo_centavos`,
       NULL, 'matched', NULL, NULL, NULL,
       `version`, `origin_id`, `sync_state`, `updated_at`
FROM `importacion_costo_proveedor_detalle`;
--> statement-breakpoint
DROP TABLE `importacion_costo_proveedor_detalle`;
--> statement-breakpoint
ALTER TABLE `importacion_costo_proveedor_detalle_new`
    RENAME TO `importacion_costo_proveedor_detalle`;
