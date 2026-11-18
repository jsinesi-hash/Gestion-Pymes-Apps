-- ADR-150 §4 y §5 (F2 PR1) — Tablas propias del hub: registro de cambios con su cursor, lo recibido
-- (idempotencia) y el log de conflictos. Van en la misma base que las tablas de la app.
CREATE TABLE `hub_cambio` (
  `seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tabla` text NOT NULL,
  `fila_id` text NOT NULL,
  `version` integer NOT NULL,
  `origin_id` text NOT NULL,
  `updated_at` integer NOT NULL,
  `fila` text NOT NULL,
  `recibido_en` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hub_cambio_fila_idx` ON `hub_cambio` (`tabla`, `fila_id`, `seq`);
--> statement-breakpoint
CREATE TABLE `hub_recibido` (
  `tabla` text NOT NULL,
  `fila_id` text NOT NULL,
  `version` integer NOT NULL,
  `origin_id` text NOT NULL,
  `resultado` text NOT NULL,
  `seq` integer,
  PRIMARY KEY (`tabla`, `fila_id`, `version`, `origin_id`)
);
--> statement-breakpoint
CREATE TABLE `hub_conflicto` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tipo` text NOT NULL,
  `tabla` text NOT NULL,
  `fila_id` text NOT NULL,
  `origin_id` text NOT NULL,
  `fila_entrante` text NOT NULL,
  `fila_actual` text,
  `detalle` text,
  `fecha` integer NOT NULL,
  `resuelto` integer DEFAULT 0 NOT NULL
);
