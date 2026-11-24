-- F3 PR1 (ADR-159) — Resolución de conflictos desde una caja y cambios en espera.
-- Un conflicto guarda cómo se resolvió, quién y cuándo. Un cambio cuya referencia todavía no existe en
-- el hub (su padre quedó rechazado por unicidad) espera acá en vez de frenar el lote entero.
ALTER TABLE `hub_conflicto` ADD `resolucion` text;
--> statement-breakpoint
ALTER TABLE `hub_conflicto` ADD `resuelto_por` text;
--> statement-breakpoint
ALTER TABLE `hub_conflicto` ADD `resuelto_en` integer;
--> statement-breakpoint
CREATE TABLE `hub_en_espera` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `origin_id` text NOT NULL,
  `tabla` text NOT NULL,
  `fila_id` text NOT NULL,
  `version` integer NOT NULL,
  `cambio` text NOT NULL,
  `recibido_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hub_en_espera_cambio` ON `hub_en_espera` (`tabla`, `fila_id`, `version`, `origin_id`);
