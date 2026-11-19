-- ADR-152 §2 y ADR-154 §2 (F2 PR5) — Permiso de terminal coordinadora (una sola fila, con vencimiento)
-- y bloques de correlativos repartidos por serie (p. ej. el SKU de Retail).
CREATE TABLE `hub_coordinadora` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `origin_id` text NOT NULL,
  `vence_en_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hub_bloque` (
  `serie` text NOT NULL,
  `desde` integer NOT NULL,
  `hasta` integer NOT NULL,
  `origin_id` text NOT NULL,
  `asignado_en` integer NOT NULL,
  PRIMARY KEY (`serie`, `desde`)
);
