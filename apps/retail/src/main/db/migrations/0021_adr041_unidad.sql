-- ADR-041: Tabla de unidades de medida
CREATE TABLE `unidad` (
	`id`                      TEXT NOT NULL PRIMARY KEY,
	`nombre`                  TEXT NOT NULL,
	`abreviatura`             TEXT NOT NULL,
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
CREATE UNIQUE INDEX `unidad_abreviatura_unique` ON `unidad` (`abreviatura`);
