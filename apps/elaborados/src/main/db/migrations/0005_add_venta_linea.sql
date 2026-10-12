CREATE TABLE `venta_linea` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`producto_venta_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`cantidad` real NOT NULL,
	`precio_unitario_centavos` integer NOT NULL,
	`descuento_linea_pct` real DEFAULT 0 NOT NULL,
	`alicuota_iva` real NOT NULL,
	`subtotal_centavos` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`venta_id`) REFERENCES `venta`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_venta_id`) REFERENCES `producto_venta`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `venta_linea_modificador` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_linea_id` text NOT NULL,
	`grupo_modificador_opcion_id` text NOT NULL,
	`articulo_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`recargo_centavos` integer DEFAULT 0 NOT NULL,
	`cantidad_consumida` real DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`venta_linea_id`) REFERENCES `venta_linea`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grupo_modificador_opcion_id`) REFERENCES `grupo_modificador_opcion`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
