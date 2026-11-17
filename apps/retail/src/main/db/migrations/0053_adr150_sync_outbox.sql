-- ADR-150 §4 y §6 (F1 PR3) — Captura de cambios para el modo distribuido. Aditiva: dos tablas locales.
-- Los triggers que llenan sync_outbox NO se crean acá: se instalan solo al pasar a modo distribuido
-- (instalarTriggersSync de @core/db). En standalone las dos tablas quedan vacías.
CREATE TABLE IF NOT EXISTS `sync_outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tabla` text NOT NULL,
	`fila_id` text NOT NULL,
	`operacion` text NOT NULL,
	`version` integer NOT NULL,
	`fila` text NOT NULL,
	`fecha` integer NOT NULL,
	`enviado_en` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_sync_outbox_pendiente` ON `sync_outbox` (`seq`) WHERE `enviado_en` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_aplicando` (
	`id` integer PRIMARY KEY NOT NULL
);
