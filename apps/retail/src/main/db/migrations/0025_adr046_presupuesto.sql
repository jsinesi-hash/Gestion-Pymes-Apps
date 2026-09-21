-- ADR-046: Módulo de Presupuesto (cotización previa a la venta)
-- Montos en centavos (INTEGER); descuentos como % (REAL); soft-delete; snapshot de
-- precio congelado AL EMITIR. numero/fecha_emision/fecha_validez null hasta emitir.
CREATE TABLE `presupuesto` (
	`id`                    TEXT NOT NULL PRIMARY KEY,
	`numero_secuencial`     INTEGER,
	`numero`                TEXT,
	`cliente_id`            TEXT REFERENCES `cliente`(`id`),
	`estado`                TEXT NOT NULL DEFAULT 'borrador',
	`fecha_emision`         INTEGER,
	`validez_dias`          INTEGER NOT NULL,
	`fecha_validez`         INTEGER,
	`descuento_global_pct`  REAL NOT NULL DEFAULT 0,
	`total_centavos`        INTEGER NOT NULL DEFAULT 0,
	`usuario_id`            TEXT NOT NULL REFERENCES `usuario`(`id`),
	`venta_id`              TEXT REFERENCES `venta`(`id`),
	`observaciones`         TEXT,
	`activo`                INTEGER NOT NULL DEFAULT 1,
	`creado_por_usuario_id` TEXT NOT NULL REFERENCES `usuario`(`id`),
	`creado_en`             INTEGER NOT NULL,
	`version`               INTEGER NOT NULL DEFAULT 1,
	`origin_id`             TEXT NOT NULL,
	`sync_state`            TEXT NOT NULL DEFAULT 'pending',
	`updated_at`            INTEGER NOT NULL,
	-- ADR-046 (sugeridos, no bloqueantes): atan estado ↔ nulabilidad de campos.
	-- borrador y anulado-desde-borrador nunca tuvieron numero: solo emitido/vencido/
	-- convertido exigen numero + fechas de emision/validez.
	CONSTRAINT `ck_presup_emitido` CHECK (
		`estado` IN ('borrador', 'anulado')
		OR (`numero` IS NOT NULL AND `fecha_emision` IS NOT NULL AND `fecha_validez` IS NOT NULL)),
	CONSTRAINT `ck_presup_convertido` CHECK (
		`estado` != 'convertido' OR `venta_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presupuesto_numero_unique` ON `presupuesto` (`numero`);
--> statement-breakpoint
-- Índice parcial para el job de vencimiento (compare-and-swap sobre estado='emitido')
CREATE INDEX `ix_presupuesto_vencimiento` ON `presupuesto` (`fecha_validez`) WHERE `estado` = 'emitido';
--> statement-breakpoint
CREATE INDEX `ix_presupuesto_cliente` ON `presupuesto` (`cliente_id`);
--> statement-breakpoint
CREATE TABLE `presupuesto_detalle` (
	`id`                       TEXT NOT NULL PRIMARY KEY,
	`presupuesto_id`           TEXT NOT NULL REFERENCES `presupuesto`(`id`),
	`producto_id`              TEXT NOT NULL REFERENCES `producto`(`id`),
	`descripcion`              TEXT NOT NULL,
	`cantidad`                 REAL NOT NULL,
	`precio_unitario_centavos` INTEGER,
	`descuento_linea_pct`      REAL NOT NULL DEFAULT 0,
	`alicuota_iva`             REAL NOT NULL DEFAULT 0,
	`subtotal_centavos`        INTEGER NOT NULL DEFAULT 0,
	`presentacion_id`          TEXT REFERENCES `producto_presentacion`(`id`),
	`version`                  INTEGER NOT NULL DEFAULT 1,
	`origin_id`                TEXT NOT NULL,
	`sync_state`               TEXT NOT NULL DEFAULT 'pending',
	`updated_at`               INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_presupuesto_detalle_presup` ON `presupuesto_detalle` (`presupuesto_id`);
--> statement-breakpoint
ALTER TABLE `venta` ADD `presupuesto_id` TEXT REFERENCES presupuesto(id);
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('presupuesto_proximo_secuencial', '1', 'number', 'Proximo secuencial de presupuesto. Incrementado atomicamente al emitir. Single-node; multinodo diferido a R4.');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('presupuesto_validez_dias_default', '15', 'number', 'Validez por defecto (dias) de un presupuesto al emitir. Editable en el momento de emitir.');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('presupuestos_habilitado', 'false', 'bool', 'Feature flag del modulo Presupuestos (ADR-044/046). Default false.');
