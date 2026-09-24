CREATE TABLE `produccion` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`articulo_id` text NOT NULL,
	`cantidad_producida` real NOT NULL,
	`costo_total_centavos` integer NOT NULL,
	`estado` text DEFAULT 'confirmada' NOT NULL,
	`fecha` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`observaciones` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `produccion_numero_unique` ON `produccion` (`numero`);--> statement-breakpoint
CREATE TABLE `receta_produccion` (
	`id` text PRIMARY KEY NOT NULL,
	`articulo_id` text NOT NULL,
	`rinde_cantidad` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receta_produccion_articulo_id_unique` ON `receta_produccion` (`articulo_id`);--> statement-breakpoint
CREATE TABLE `receta_produccion_item` (
	`id` text PRIMARY KEY NOT NULL,
	`receta_produccion_id` text NOT NULL,
	`articulo_id` text NOT NULL,
	`cantidad` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`receta_produccion_id`) REFERENCES `receta_produccion`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
