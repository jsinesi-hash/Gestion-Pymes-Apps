-- ADR-034: Lista de Precios — motor de reglas, vigencia y auditoría histórica
-- Tabla de valores absolutos con historización SCD tipo 2 por (lista, producto)
CREATE TABLE IF NOT EXISTS `lista_precio_valor` (
    `id`                  TEXT PRIMARY KEY NOT NULL,
    `lista_precio_id`     TEXT NOT NULL REFERENCES `lista_precio`(`id`),
    `producto_id`         TEXT NOT NULL REFERENCES `producto`(`id`),
    `precio_centavos`     INTEGER NOT NULL,
    `fecha_desde`         INTEGER NOT NULL,
    `fecha_hasta`         INTEGER,
    `origen`              TEXT NOT NULL DEFAULT 'manual',
    `recalculo_masivo_id` TEXT,
    `usuario_id`          TEXT NOT NULL,
    `version`             INTEGER NOT NULL DEFAULT 1,
    `origin_id`           TEXT NOT NULL,
    `sync_state`          TEXT NOT NULL DEFAULT 'pending',
    `updated_at`          INTEGER NOT NULL
);
--> statement-breakpoint
-- Un único precio vigente por (lista, producto)
CREATE UNIQUE INDEX IF NOT EXISTS `lpv_vigente_unique`
    ON `lista_precio_valor` (`lista_precio_id`, `producto_id`)
    WHERE `fecha_hasta` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lpv_lista_producto_idx`
    ON `lista_precio_valor` (`lista_precio_id`, `producto_id`);
--> statement-breakpoint

-- Registro de recálculos masivos (audit + referencia desde lista_precio_valor)
CREATE TABLE IF NOT EXISTS `recalculo_masivo` (
    `id`                    TEXT PRIMARY KEY NOT NULL,
    `lista_precio_id`       TEXT NOT NULL REFERENCES `lista_precio`(`id`),
    `porcentaje`            REAL NOT NULL,
    `base_calculo`          TEXT NOT NULL,
    `base_lista_id`         TEXT,
    `base_valor_centavos`   INTEGER,
    `alcance`               TEXT NOT NULL,
    `alcance_id`            TEXT,
    `excluir_manuales_dias` INTEGER,
    `productos_afectados`   INTEGER NOT NULL DEFAULT 0,
    `estado`                TEXT NOT NULL DEFAULT 'aplicado',
    `usuario_id`            TEXT NOT NULL,
    `fecha_ejecucion`       INTEGER NOT NULL,
    `observaciones`         TEXT,
    `version`               INTEGER NOT NULL DEFAULT 1,
    `origin_id`             TEXT NOT NULL,
    `sync_state`            TEXT NOT NULL DEFAULT 'pending',
    `updated_at`            INTEGER NOT NULL
);
--> statement-breakpoint

-- Promociones temporales (pisan lista_precio_valor mientras están activas)
CREATE TABLE IF NOT EXISTS `promocion` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `lista_precio_id`         TEXT NOT NULL REFERENCES `lista_precio`(`id`),
    `producto_id`             TEXT NOT NULL REFERENCES `producto`(`id`),
    `precio_centavos`         INTEGER NOT NULL,
    `fecha_desde`             INTEGER NOT NULL,
    `fecha_hasta`             INTEGER NOT NULL,
    `descripcion`             TEXT,
    `activo`                  INTEGER NOT NULL DEFAULT 1,
    `usuario_creacion_id`     TEXT NOT NULL,
    `fecha_creacion`          INTEGER NOT NULL,
    `usuario_modificacion_id` TEXT,
    `fecha_actualizacion`     INTEGER,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL
);
--> statement-breakpoint

-- Cambios de precio programados para fecha futura
CREATE TABLE IF NOT EXISTS `cambio_programado` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `lista_precio_id`         TEXT NOT NULL REFERENCES `lista_precio`(`id`),
    `porcentaje`              REAL NOT NULL,
    `base_calculo`            TEXT NOT NULL,
    `base_lista_id`           TEXT,
    `base_valor_centavos`     INTEGER,
    `alcance`                 TEXT NOT NULL,
    `alcance_id`              TEXT,
    `excluir_manuales_dias`   INTEGER,
    `fecha_aplicacion`        INTEGER NOT NULL,
    `estado`                  TEXT NOT NULL DEFAULT 'pendiente',
    `recalculo_masivo_id`     TEXT,
    `usuario_creacion_id`     TEXT NOT NULL,
    `fecha_creacion`          INTEGER NOT NULL,
    `usuario_modificacion_id` TEXT,
    `fecha_actualizacion`     INTEGER,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL
);
--> statement-breakpoint

-- Trazabilidad de importaciones de costos de proveedor por archivo
CREATE TABLE IF NOT EXISTS `importacion_costo_proveedor` (
    `id`                  TEXT PRIMARY KEY NOT NULL,
    `proveedor_id`        TEXT NOT NULL REFERENCES `proveedor`(`id`),
    `nombre_archivo`      TEXT NOT NULL,
    `fecha_importacion`   INTEGER NOT NULL,
    `filas_totales`       INTEGER NOT NULL DEFAULT 0,
    `filas_matcheadas`    INTEGER NOT NULL DEFAULT 0,
    `filas_sin_match`     INTEGER NOT NULL DEFAULT 0,
    `estado`              TEXT NOT NULL DEFAULT 'pendiente',
    `usuario_id`          TEXT NOT NULL,
    `observaciones`       TEXT,
    `version`             INTEGER NOT NULL DEFAULT 1,
    `origin_id`           TEXT NOT NULL,
    `sync_state`          TEXT NOT NULL DEFAULT 'pending',
    `updated_at`          INTEGER NOT NULL
);
--> statement-breakpoint

INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('precios.recalculo.dias_exclusion_manual', '30', 'number',
        'Días de exclusión de precios cargados manualmente en recálculo masivo');
