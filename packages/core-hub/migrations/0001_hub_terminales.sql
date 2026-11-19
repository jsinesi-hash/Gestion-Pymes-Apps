-- ADR-150 §2 (F2 PR2) — Terminales emparejadas y códigos de emparejamiento de un solo uso.
CREATE TABLE `hub_terminal` (
  `origin_id` text PRIMARY KEY NOT NULL,
  `nombre` text NOT NULL,
  `credencial_hash` text NOT NULL,
  `emparejada_en` integer NOT NULL,
  `revocada_en` integer,
  `ultimo_contacto` integer,
  `version_protocolo` integer,
  `version_esquema` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hub_terminal_credencial_hash_unique` ON `hub_terminal` (`credencial_hash`);
--> statement-breakpoint
CREATE TABLE `hub_codigo` (
  `codigo_hash` text PRIMARY KEY NOT NULL,
  `creado_en` integer NOT NULL,
  `vence_en` integer NOT NULL,
  `usado_en` integer,
  `origin_id` text
);
