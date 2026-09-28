CREATE TABLE `categoria_venta` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grupo_modificador` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grupo_modificador_opcion` (
	`id` text PRIMARY KEY NOT NULL,
	`grupo_modificador_id` text NOT NULL,
	`articulo_id` text NOT NULL,
	`nombre` text NOT NULL,
	`recargo_centavos` integer DEFAULT 0 NOT NULL,
	`cantidad` real DEFAULT 0 NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`grupo_modificador_id`) REFERENCES `grupo_modificador`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `producto_venta` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`categoria_venta_id` text NOT NULL,
	`precio_centavos` integer NOT NULL,
	`impuesto_id` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`categoria_venta_id`) REFERENCES `categoria_venta`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`impuesto_id`) REFERENCES `impuesto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `producto_venta_componente` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_venta_id` text NOT NULL,
	`articulo_id` text NOT NULL,
	`cantidad` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`producto_venta_id`) REFERENCES `producto_venta`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `producto_venta_grupo` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_venta_id` text NOT NULL,
	`grupo_modificador_id` text NOT NULL,
	`min` integer DEFAULT 0 NOT NULL,
	`max` integer DEFAULT 1 NOT NULL,
	`cantidad_total` real DEFAULT 0 NOT NULL,
	`modo_descuento` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`producto_venta_id`) REFERENCES `producto_venta`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grupo_modificador_id`) REFERENCES `grupo_modificador`(`id`) ON UPDATE no action ON DELETE no action
);
