CREATE TABLE `articulo` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`unidad` text NOT NULL,
	`bloquea_sin_stock` integer DEFAULT true NOT NULL,
	`stock_minimo` real,
	`costo_promedio_centavos` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `existencia_articulo` (
	`id` text PRIMARY KEY NOT NULL,
	`articulo_id` text NOT NULL,
	`stock` real DEFAULT 0 NOT NULL,
	`ultima_fecha_movimiento` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `existencia_articulo_articulo_id_unique` ON `existencia_articulo` (`articulo_id`);--> statement-breakpoint
CREATE TABLE `movimiento_articulo` (
	`id` text PRIMARY KEY NOT NULL,
	`articulo_id` text NOT NULL,
	`tipo` text NOT NULL,
	`motivo` text NOT NULL,
	`cantidad` real NOT NULL,
	`stock_resultante` real NOT NULL,
	`costo_unitario_centavos` integer,
	`referencia_tipo` text NOT NULL,
	`referencia_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`fecha` integer NOT NULL,
	`observaciones` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
