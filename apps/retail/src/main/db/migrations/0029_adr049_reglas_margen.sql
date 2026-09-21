-- ADR-049 Fase 2 — Reglas de margen + modo de cálculo por lista.
-- Aditiva y retrocompatible: lista_precio.modo_calculo default 'pct_sobre_lista' =>
-- el comportamiento de precios no cambia hasta que se configure una lista en 'margen_costo'.

ALTER TABLE `lista_precio` ADD COLUMN `modo_calculo` TEXT NOT NULL DEFAULT 'pct_sobre_lista';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `regla_precio` (
	`id` text PRIMARY KEY NOT NULL,
	`lista_precio_id` text NOT NULL,
	`tipo` text NOT NULL,
	`objetivo_id` text,
	`margen_pct` real NOT NULL DEFAULT 0,
	`margen_min_pct` real,
	`margen_max_pct` real,
	`redondeo_modo` text NOT NULL DEFAULT 'ninguno',
	`redondeo_valor` integer,
	`prioridad` integer NOT NULL DEFAULT 100,
	`activo` integer NOT NULL DEFAULT 1,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer NOT NULL DEFAULT 1,
	`origin_id` text NOT NULL,
	`sync_state` text NOT NULL DEFAULT 'pending',
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_regla_precio_lista` ON `regla_precio` (`lista_precio_id`);
