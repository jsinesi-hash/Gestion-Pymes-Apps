-- ADR-034: tabla de trazabilidad de cambios de costo por importación (estructura lista para ADR-035)
CREATE TABLE `importacion_costo_proveedor_detalle` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `importacion_id`          TEXT NOT NULL REFERENCES `importacion_costo_proveedor`(`id`),
    `producto_id`             TEXT NOT NULL REFERENCES `producto`(`id`),
    `costo_anterior_centavos` INTEGER,
    `costo_nuevo_centavos`    INTEGER NOT NULL,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL
);
