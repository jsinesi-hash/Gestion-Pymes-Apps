CREATE TABLE `marca` (
  `id` text PRIMARY KEY NOT NULL,
  `nombre` text NOT NULL,
  `activo` integer DEFAULT 1 NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `origin_id` text NOT NULL,
  `sync_state` text DEFAULT 'pending' NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marca_nombre_unique` ON `marca` (`nombre`);
--> statement-breakpoint
CREATE TABLE `articulo` (
  `id` text PRIMARY KEY NOT NULL,
  `marca_id` text REFERENCES `marca`(`id`),
  `nombre` text NOT NULL,
  `stock` real NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `origin_id` text NOT NULL,
  `sync_state` text DEFAULT 'pending' NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movimiento` (
  `id` text PRIMARY KEY NOT NULL,
  `articulo_id` text NOT NULL REFERENCES `articulo`(`id`),
  `cantidad` real NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `origin_id` text NOT NULL,
  `sync_state` text DEFAULT 'pending' NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `nota_local` (
  `id` text PRIMARY KEY NOT NULL,
  `texto` text
);
