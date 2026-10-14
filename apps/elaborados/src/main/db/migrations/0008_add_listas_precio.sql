CREATE TABLE `lista_precio` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	`tipo` text DEFAULT 'general' NOT NULL,
	`ajuste_porcentual` real DEFAULT 0 NOT NULL,
	`modo_calculo` text DEFAULT 'pct_sobre_lista' NOT NULL,
	`predeterminada` integer DEFAULT false NOT NULL,
	`vigencia_desde` integer,
	`vigencia_hasta` integer,
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
CREATE UNIQUE INDEX `lista_precio_nombre_unique` ON `lista_precio` (`nombre`);--> statement-breakpoint
CREATE TABLE `producto_venta_precio` (
	`id` text PRIMARY KEY NOT NULL,
	`lista_precio_id` text NOT NULL,
	`producto_venta_id` text NOT NULL,
	`precio_centavos` integer NOT NULL,
	`fecha_desde` integer NOT NULL,
	`fecha_hasta` integer,
	`usuario_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_venta_id`) REFERENCES `producto_venta`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `__new_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_documento` text NOT NULL,
	`numero_documento` text NOT NULL,
	`nombre` text NOT NULL,
	`apellido` text NOT NULL,
	`nombre_fantasia` text,
	`condicion_fiscal` text NOT NULL,
	`domicilio` text,
	`localidad_id` text,
	`localidad` text,
	`provincia` text,
	`codigo_postal` text,
	`calle` text,
	`numero` text,
	`aclaracion` text,
	`telefono_adicional` text,
	`telefono` text,
	`email` text,
	`habilita_cuenta_corriente` integer DEFAULT false NOT NULL,
	`lista_precio_id` text,
	`activo` integer DEFAULT true NOT NULL,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`localidad_id`) REFERENCES `localidad`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_cliente`("id", "tipo_documento", "numero_documento", "nombre", "apellido", "nombre_fantasia", "condicion_fiscal", "domicilio", "localidad_id", "localidad", "provincia", "codigo_postal", "calle", "numero", "aclaracion", "telefono_adicional", "telefono", "email", "habilita_cuenta_corriente", "lista_precio_id", "activo", "usuario_creacion_id", "fecha_creacion", "usuario_modificacion_id", "fecha_actualizacion", "version", "origin_id", "sync_state", "updated_at") SELECT "id", "tipo_documento", "numero_documento", "nombre", "apellido", "nombre_fantasia", "condicion_fiscal", "domicilio", "localidad_id", "localidad", "provincia", "codigo_postal", "calle", "numero", "aclaracion", "telefono_adicional", "telefono", "email", "habilita_cuenta_corriente", "lista_precio_id", "activo", "usuario_creacion_id", "fecha_creacion", "usuario_modificacion_id", "fecha_actualizacion", "version", "origin_id", "sync_state", "updated_at" FROM `cliente`;--> statement-breakpoint
DROP TABLE `cliente`;--> statement-breakpoint
ALTER TABLE `__new_cliente` RENAME TO `cliente`;--> statement-breakpoint
CREATE UNIQUE INDEX `producto_venta_precio_vigente_unique` ON `producto_venta_precio` (`lista_precio_id`, `producto_venta_id`) WHERE `fecha_hasta` IS NULL;
