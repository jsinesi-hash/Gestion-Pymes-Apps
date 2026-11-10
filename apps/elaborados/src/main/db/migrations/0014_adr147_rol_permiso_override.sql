-- ADR-147 — Permisos de un rol editados desde «Roles y permisos». Aditiva y retrocompatible: tabla nueva.
-- otorgado = 0 es una revocación que runSeed respeta en cada arranque; otorgado = 1, un permiso agregado.
CREATE TABLE IF NOT EXISTS `rol_permiso_override` (
	`id` text PRIMARY KEY NOT NULL,
	`rol_id` text NOT NULL,
	`permiso_id` text NOT NULL,
	`otorgado` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permiso_id`) REFERENCES `permiso`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ux_rol_permiso_override` ON `rol_permiso_override` (`rol_id`,`permiso_id`);
