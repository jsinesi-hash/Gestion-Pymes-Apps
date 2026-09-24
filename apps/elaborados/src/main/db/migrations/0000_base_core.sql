CREATE TABLE `permiso` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`descripcion` text,
	`modulo` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permiso_codigo_unique` ON `permiso` (`codigo`);--> statement-breakpoint
CREATE TABLE `rol` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	`es_sistema` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rol_nombre_unique` ON `rol` (`nombre`);--> statement-breakpoint
CREATE TABLE `rol_permiso` (
	`id` text PRIMARY KEY NOT NULL,
	`rol_id` text NOT NULL,
	`permiso_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permiso_id`) REFERENCES `permiso`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre_usuario` text NOT NULL,
	`nombre_completo` text NOT NULL,
	`hash_password` text NOT NULL,
	`rol_id` text NOT NULL,
	`email` text,
	`activo` integer DEFAULT true NOT NULL,
	`ultimo_acceso` integer,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_nombre_usuario_unique` ON `usuario` (`nombre_usuario`);--> statement-breakpoint
CREATE TABLE `usuario_preferencias` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`tema` text DEFAULT 'claro' NOT NULL,
	`acento` text DEFAULT 'blue' NOT NULL,
	`ui_font` text DEFAULT 'Hanken Grotesk' NOT NULL,
	`densidad` text DEFAULT 'comfortable' NOT NULL,
	`skin` text DEFAULT 'actual' NOT NULL,
	`pantalla_inicio` text,
	`favoritos` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_preferencias_usuario_id_unique` ON `usuario_preferencias` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `cliente` (
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
	FOREIGN KEY (`localidad_id`) REFERENCES `localidad`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proveedor` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_documento` text NOT NULL,
	`numero_documento` text NOT NULL,
	`razon_social` text NOT NULL,
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
	`persona_contacto` text,
	`observaciones` text,
	`codigo` text,
	`bonificacion_pct_default` real DEFAULT 0 NOT NULL,
	`costo_financiero_pct_default` real DEFAULT 0 NOT NULL,
	`flete_pct_default` real DEFAULT 0 NOT NULL,
	`match_umbral_preseleccion` integer,
	`activo` integer DEFAULT true NOT NULL,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`localidad_id`) REFERENCES `localidad`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proveedor_codigo_unique` ON `proveedor` (`codigo`);--> statement-breakpoint
CREATE TABLE `departamento` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL,
	`provincia_id` text NOT NULL,
	FOREIGN KEY (`provincia_id`) REFERENCES `provincia`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_depto_prov` ON `departamento` (`provincia_id`);--> statement-breakpoint
CREATE TABLE `localidad` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL,
	`provincia_id` text NOT NULL,
	`departamento_id` text,
	`codigo_postal` text,
	FOREIGN KEY (`provincia_id`) REFERENCES `provincia`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`departamento_id`) REFERENCES `departamento`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loc_prov` ON `localidad` (`provincia_id`);--> statement-breakpoint
CREATE INDEX `idx_loc_norm` ON `localidad` (`nombre_norm`);--> statement-breakpoint
CREATE INDEX `idx_loc_cp` ON `localidad` (`codigo_postal`);--> statement-breakpoint
CREATE TABLE `provincia` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`nombre_norm` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cuenta_corriente_cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`saldo_centavos` integer DEFAULT 0 NOT NULL,
	`limite_credito_centavos` integer DEFAULT 0 NOT NULL,
	`fecha_ultimo_movimiento` integer,
	`activo` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cuenta_corriente_cliente_cliente_id_unique` ON `cuenta_corriente_cliente` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `movimiento_cuenta_corriente` (
	`id` text PRIMARY KEY NOT NULL,
	`cuenta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`motivo` text NOT NULL,
	`monto_centavos` integer NOT NULL,
	`saldo_resultante_centavos` integer NOT NULL,
	`referencia_tipo` text,
	`referencia_id` text,
	`usuario_id` text NOT NULL,
	`fecha` integer NOT NULL,
	`observaciones` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cuenta_id`) REFERENCES `cuenta_corriente_cliente`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parametros_sistema` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`tipo` text NOT NULL,
	`descripcion` text,
	`actualizado_en` integer,
	`actualizado_por` text,
	FOREIGN KEY (`actualizado_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `caja` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`fecha_apertura` integer NOT NULL,
	`fecha_cierre` integer,
	`monto_inicial` real DEFAULT 0 NOT NULL,
	`monto_esperado` real,
	`monto_contado` real,
	`diferencia` real,
	`estado` text DEFAULT 'abierta' NOT NULL,
	`observaciones` text,
	`usuario_cierre_id` text,
	`supervisor_autorizacion_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comprobante` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text,
	`tipo` text NOT NULL,
	`punto_venta` integer,
	`numero` text,
	`fecha_emision` integer NOT NULL,
	`cae` text,
	`cae_vencimiento` integer,
	`condicion_fiscal_emisor` text,
	`condicion_fiscal_receptor` text,
	`importe_neto` real DEFAULT 0 NOT NULL,
	`importe_iva` real DEFAULT 0 NOT NULL,
	`importe_total` real DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'pendiente_cae' NOT NULL,
	`comprobante_referencia_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movimiento_caja` (
	`id` text PRIMARY KEY NOT NULL,
	`caja_id` text NOT NULL,
	`tipo` text NOT NULL,
	`motivo` text NOT NULL,
	`monto` real NOT NULL,
	`forma_pago` text,
	`referencia_tipo` text NOT NULL,
	`referencia_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`fecha` integer NOT NULL,
	`observaciones` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `venta` (
	`id` text PRIMARY KEY NOT NULL,
	`numero_interno` text NOT NULL,
	`fecha` integer NOT NULL,
	`cliente_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`caja_id` text NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`descuento_global` real DEFAULT 0 NOT NULL,
	`importe_iva` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`ajuste_redondeo` real DEFAULT 0 NOT NULL,
	`vuelto_centavos` integer,
	`forma_pago` text NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`alias` text,
	`en_espera_desde` integer,
	`turno_creacion_id` text,
	`comprobante_id` text,
	`presupuesto_id` text,
	`observaciones` text,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comprobante_id`) REFERENCES `comprobante`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venta_numero_interno_unique` ON `venta` (`numero_interno`);--> statement-breakpoint
CREATE TABLE `venta_pago` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`medio_pago` text NOT NULL,
	`monto_centavos` integer NOT NULL,
	`recargo_pct` real DEFAULT 0 NOT NULL,
	`recargo_centavos` integer DEFAULT 0 NOT NULL,
	`numero_cheque` text,
	`banco` text,
	`fecha_cheque` integer,
	`titular_cheque` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`venta_id`) REFERENCES `venta`(`id`) ON UPDATE no action ON DELETE no action
);
