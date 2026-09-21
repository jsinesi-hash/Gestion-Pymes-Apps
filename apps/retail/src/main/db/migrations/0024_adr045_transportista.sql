CREATE TABLE `transportista` (
	`id` TEXT NOT NULL PRIMARY KEY,
	`razon_social` TEXT NOT NULL,
	`telefono` TEXT,
	`email` TEXT,
	`persona_contacto` TEXT,
	`domicilio` TEXT,
	`observaciones` TEXT,
	`activo` INTEGER NOT NULL DEFAULT 1,
	`usuario_creacion_id` TEXT NOT NULL,
	`fecha_creacion` INTEGER NOT NULL,
	`usuario_modificacion_id` TEXT,
	`fecha_actualizacion` INTEGER,
	`version` INTEGER NOT NULL DEFAULT 1,
	`origin_id` TEXT NOT NULL,
	`sync_state` TEXT NOT NULL DEFAULT 'pending',
	`updated_at` INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE `remito` ADD `transportista_id` TEXT REFERENCES transportista(id);
