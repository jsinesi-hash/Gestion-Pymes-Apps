CREATE TABLE IF NOT EXISTS `departamento` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL,
	`provincia_id` text NOT NULL,
	FOREIGN KEY (`provincia_id`) REFERENCES `provincia`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_depto_prov` ON `departamento` (`provincia_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `localidad` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL,
	`provincia_id` text NOT NULL,
	`departamento_id` text,
	`codigo_postal` text,
	FOREIGN KEY (`provincia_id`) REFERENCES `provincia`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`departamento_id`) REFERENCES `departamento`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_loc_prov` ON `localidad` (`provincia_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_loc_norm` ON `localidad` (`nombre_norm`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_loc_cp` ON `localidad` (`codigo_postal`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `provincia` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL
);
