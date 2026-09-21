-- ADR-054: historial persistido de importaciones de CATÁLOGO de proveedor.
-- Migración ADITIVA (solo CREATE TABLE + índice). Espejo de las tablas de costos de
-- ADR-035. Dinero en centavos (INTEGER). No toca ninguna tabla existente.
CREATE TABLE `importacion_catalogo_proveedor` (
    `id`                   TEXT PRIMARY KEY NOT NULL,
    `proveedor_id`         TEXT NOT NULL REFERENCES `proveedor`(`id`),
    `nombre_archivo`       TEXT NOT NULL,
    `fecha_importacion`    INTEGER NOT NULL,
    `filas_totales`        INTEGER NOT NULL DEFAULT 0,
    `filas_creadas`        INTEGER NOT NULL DEFAULT 0,
    `filas_actualizadas`   INTEGER NOT NULL DEFAULT 0,
    `filas_sin_match`      INTEGER NOT NULL DEFAULT 0,
    `filas_error`          INTEGER NOT NULL DEFAULT 0,
    `preferidos_asignados` INTEGER NOT NULL DEFAULT 0,
    `estado`               TEXT NOT NULL DEFAULT 'confirmado',
    `usuario_id`           TEXT NOT NULL,
    `observaciones`        TEXT,
    `version`              INTEGER NOT NULL DEFAULT 1,
    `origin_id`            TEXT NOT NULL,
    `sync_state`           TEXT NOT NULL DEFAULT 'pending',
    `updated_at`           INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE `importacion_catalogo_proveedor_detalle` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `importacion_id`          TEXT NOT NULL REFERENCES `importacion_catalogo_proveedor`(`id`),
    `producto_id`             TEXT REFERENCES `producto`(`id`),
    `costo_centavos`          INTEGER,
    `costo_anterior_centavos` INTEGER,
    `codigo_producto_prov`    TEXT,
    `fila_original`           TEXT,
    `estado`                  TEXT NOT NULL,
    `matched_by`              TEXT,
    `preferido_asignado`      INTEGER NOT NULL DEFAULT 0,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `icat_detalle_importacion_idx`
    ON `importacion_catalogo_proveedor_detalle` (`importacion_id`);
