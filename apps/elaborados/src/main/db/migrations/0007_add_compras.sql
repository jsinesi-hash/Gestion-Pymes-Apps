CREATE TABLE `compra` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`proveedor_id` text,
	`comprobante` text,
	`total_centavos` integer NOT NULL,
	`estado` text DEFAULT 'confirmada' NOT NULL,
	`fecha` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`observaciones` text,
	`motivo_anulacion` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compra_numero_unique` ON `compra` (`numero`);--> statement-breakpoint
CREATE TABLE `compra_item` (
	`id` text PRIMARY KEY NOT NULL,
	`compra_id` text NOT NULL,
	`articulo_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`cantidad` real NOT NULL,
	`costo_unitario_centavos` integer NOT NULL,
	`subtotal_centavos` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`compra_id`) REFERENCES `compra`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`articulo_id`) REFERENCES `articulo`(`id`) ON UPDATE no action ON DELETE no action
);
