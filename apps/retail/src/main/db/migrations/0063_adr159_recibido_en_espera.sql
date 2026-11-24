-- F3 PR1 (ADR-159) — Cambios recibidos del hub que la terminal todavía no puede aplicar (choque de unicidad
-- con una fila local rechazada por el hub, o referencia a una fila que espera). Aditiva: una tabla local.
CREATE TABLE IF NOT EXISTS `sync_recibido_en_espera` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seq` integer NOT NULL,
	`tabla` text NOT NULL,
	`fila_id` text NOT NULL,
	`cambio` text NOT NULL,
	`motivo` text NOT NULL,
	`recibido_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ux_sync_recibido_en_espera_seq` ON `sync_recibido_en_espera` (`seq`);
