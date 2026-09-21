-- ADR-040: Multi-presentación de venta (tabla producto_presentacion + columnas en lista_precio_valor y venta_detalle)

-- PASO 1: Seed de unidades faltantes desde unidad_venta de productos
-- (strings libres existentes → filas en unidad por abreviatura)
INSERT OR IGNORE INTO unidad (
  id, nombre, abreviatura, activo,
  usuario_creacion_id, fecha_creacion,
  version, origin_id, sync_state, updated_at
)
SELECT DISTINCT
  lower(hex(randomblob(16))), p.unidad_venta, p.unidad_venta,
  1, 'system', unixepoch(), 1, 'system', 'pending', unixepoch()
FROM producto p
WHERE p.unidad_venta IS NOT NULL AND p.unidad_venta != ''
  AND NOT EXISTS (SELECT 1 FROM unidad u WHERE u.abreviatura = p.unidad_venta);
--> statement-breakpoint

-- PASO 2: Seed de unidades faltantes desde unidad_compra de productos
INSERT OR IGNORE INTO unidad (
  id, nombre, abreviatura, activo,
  usuario_creacion_id, fecha_creacion,
  version, origin_id, sync_state, updated_at
)
SELECT DISTINCT
  lower(hex(randomblob(16))), p.unidad_compra, p.unidad_compra,
  1, 'system', unixepoch(), 1, 'system', 'pending', unixepoch()
FROM producto p
WHERE p.unidad_compra IS NOT NULL AND p.unidad_compra != ''
  AND NOT EXISTS (SELECT 1 FROM unidad u WHERE u.abreviatura = p.unidad_compra);
--> statement-breakpoint

-- PASO 3: Crear tabla producto_presentacion
CREATE TABLE `producto_presentacion` (
	`id`             TEXT NOT NULL PRIMARY KEY,
	`producto_id`    TEXT NOT NULL REFERENCES producto(id),
	`unidad_id`      TEXT NOT NULL REFERENCES unidad(id),
	`factor_a_stock` REAL NOT NULL DEFAULT 1.0,
	`gtin_barcode`   TEXT,
	`es_default`     INTEGER NOT NULL DEFAULT 0,
	`activo`         INTEGER NOT NULL DEFAULT 1,
	`sin_confirmar`  INTEGER NOT NULL DEFAULT 0,
	`version`        INTEGER NOT NULL DEFAULT 1,
	`origin_id`      TEXT NOT NULL,
	`sync_state`     TEXT NOT NULL DEFAULT 'pending',
	`updated_at`     INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_pp_gtin`
	ON `producto_presentacion` (`gtin_barcode`)
	WHERE `gtin_barcode` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_pp_default`
	ON `producto_presentacion` (`producto_id`)
	WHERE `es_default` = 1;
--> statement-breakpoint

-- PASO 4: Presentación default para cada producto existente
INSERT INTO producto_presentacion (
  id, producto_id, unidad_id, factor_a_stock,
  gtin_barcode, es_default, activo, sin_confirmar,
  version, origin_id, sync_state, updated_at
)
SELECT
  lower(hex(randomblob(16))),
  p.id,
  u.id,
  1.0,
  NULL,
  1,
  1,
  0,
  1, 'system', 'pending', unixepoch()
FROM producto p
JOIN unidad u ON u.abreviatura = p.unidad_venta;
--> statement-breakpoint

-- PASO 5: Agregar presentacion_id a lista_precio_valor (nullable por limitación SQLite ALTER TABLE)
ALTER TABLE `lista_precio_valor` ADD COLUMN `presentacion_id` TEXT REFERENCES producto_presentacion(id);
--> statement-breakpoint

-- PASO 6: Reasignar filas existentes de lista_precio_valor a su presentación default
UPDATE lista_precio_valor
SET presentacion_id = (
  SELECT pp.id FROM producto_presentacion pp
  WHERE pp.producto_id = lista_precio_valor.producto_id
    AND pp.es_default = 1
);
--> statement-breakpoint

-- PASO 7: Columnas snapshot en venta_detalle (nullable para ventas históricas)
ALTER TABLE `venta_detalle` ADD COLUMN `presentacion_id` TEXT REFERENCES producto_presentacion(id);
--> statement-breakpoint
ALTER TABLE `venta_detalle` ADD COLUMN `factor_a_stock_aplicado` REAL;
