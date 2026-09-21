-- ADR-045: Módulo de Remitos (documento de entrega interno)
CREATE TABLE `remito` (
	`id`                     TEXT NOT NULL PRIMARY KEY,
	`numero_secuencial`      INTEGER NOT NULL,
	`numero`                 TEXT NOT NULL,
	`venta_id`               TEXT NOT NULL REFERENCES `venta`(`id`),
	`comprobante_id`         TEXT REFERENCES `comprobante`(`id`),
	`estado`                 TEXT NOT NULL DEFAULT 'emitido',
	`fecha_emision`          INTEGER NOT NULL,
	`fecha_entrega`          INTEGER,
	`recibido_por`           TEXT,
	`domicilio_entrega`      TEXT,
	`transportista`          TEXT,
	`observaciones`          TEXT,
	`anulado_en`             INTEGER,
	`anulado_por_usuario_id` TEXT REFERENCES `usuario`(`id`),
	`motivo_anulacion`       TEXT,
	`activo`                 INTEGER NOT NULL DEFAULT 1,
	`creado_por_usuario_id`  TEXT NOT NULL REFERENCES `usuario`(`id`),
	`creado_en`              INTEGER NOT NULL,
	`version`                INTEGER NOT NULL DEFAULT 1,
	`origin_id`              TEXT NOT NULL,
	`sync_state`             TEXT NOT NULL DEFAULT 'pending',
	`updated_at`             INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remito_numero_unique` ON `remito` (`numero`);
--> statement-breakpoint
CREATE INDEX `ix_remito_venta` ON `remito` (`venta_id`);
--> statement-breakpoint
CREATE TABLE `remito_linea` (
	`id`                 TEXT NOT NULL PRIMARY KEY,
	`remito_id`          TEXT NOT NULL REFERENCES `remito`(`id`),
	`venta_detalle_id`   TEXT NOT NULL REFERENCES `venta_detalle`(`id`),
	`cantidad_entregada` REAL NOT NULL,
	`producto_id`        TEXT NOT NULL REFERENCES `producto`(`id`),
	`descripcion`        TEXT NOT NULL,
	`unidad`             TEXT,
	`version`            INTEGER NOT NULL DEFAULT 1,
	`origin_id`          TEXT NOT NULL,
	`sync_state`         TEXT NOT NULL DEFAULT 'pending',
	`updated_at`         INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_remito_linea_remito` ON `remito_linea` (`remito_id`);
--> statement-breakpoint
-- Sostiene la consulta de entregado-vs-pendiente por linea de venta (ADR-045 §7)
CREATE INDEX `ix_remito_linea_venta_detalle` ON `remito_linea` (`venta_detalle_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('remito_proximo_secuencial', '1', 'number', 'Proximo secuencial de remito. Incrementado atomicamente al emitir. Single-node; multinodo diferido a R4.');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('remitos_habilitado', 'false', 'bool', 'Feature flag del modulo Remitos (ADR-044). Default false.');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('remito_valorizado', 'false', 'bool', 'Reservado ADR-045: render valorizado del remito. No cableado en v1.');
