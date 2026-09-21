CREATE TABLE `categoria` (
	`id` text PRIMARY KEY NOT NULL,
	`categoria_padre_id` text,
	`nombre` text NOT NULL,
	`descripcion` text,
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
CREATE TABLE `existencias` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_id` text NOT NULL,
	`stock_fisico` real DEFAULT 0 NOT NULL,
	`stock_reservado` real,
	`stock_en_transito` real,
	`stock_minimo` real DEFAULT 0 NOT NULL,
	`stock_maximo` real,
	`ultima_fecha_movimiento` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `existencias_producto_id_unique` ON `existencias` (`producto_id`);--> statement-breakpoint
CREATE TABLE `impuesto` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`tipo` text NOT NULL,
	`alicuota` real NOT NULL,
	`codigo_arca` text,
	`predeterminado` integer DEFAULT false NOT NULL,
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
CREATE TABLE `marca` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
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
CREATE UNIQUE INDEX `marca_nombre_unique` ON `marca` (`nombre`);--> statement-breakpoint
CREATE TABLE `movimiento_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_id` text NOT NULL,
	`tipo` text NOT NULL,
	`motivo` text NOT NULL,
	`cantidad` real NOT NULL,
	`stock_resultante` real NOT NULL,
	`costo_unitario` real,
	`referencia_tipo` text NOT NULL,
	`referencia_id` text NOT NULL,
	`ubicacion_id` text,
	`usuario_id` text NOT NULL,
	`fecha` integer NOT NULL,
	`observaciones` text,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `producto` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`codigo_qr` text NOT NULL,
	`gtin_barcode` text,
	`nombre_corto` text NOT NULL,
	`nombre_largo` text NOT NULL,
	`descripcion_tecnica` text,
	`unidad_venta` text NOT NULL,
	`unidad_compra` text,
	`factor_conversion` real DEFAULT 1 NOT NULL,
	`permite_fraccion` integer DEFAULT false NOT NULL,
	`precio_costo_promedio` real DEFAULT 0 NOT NULL,
	`precio_venta_lista` real DEFAULT 0 NOT NULL,
	`margen_ganancia` real,
	`impuesto_id` text,
	`moneda` text DEFAULT 'ARS' NOT NULL,
	`categoria_id` text NOT NULL,
	`marca_id` text,
	`producto_padre_id` text,
	`garantia_meses` integer,
	`ubicacion_id` text,
	`activo` integer DEFAULT true NOT NULL,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`impuesto_id`) REFERENCES `impuesto`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marca_id`) REFERENCES `marca`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ubicacion_id`) REFERENCES `ubicacion`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `producto_sku_unique` ON `producto` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `producto_codigo_qr_unique` ON `producto` (`codigo_qr`);--> statement-breakpoint
CREATE TABLE `ubicacion` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`sector` text NOT NULL,
	`estante` text NOT NULL,
	`posicion` text NOT NULL,
	`descripcion` text,
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
CREATE UNIQUE INDEX `ubicacion_codigo_unique` ON `ubicacion` (`codigo`);--> statement-breakpoint
CREATE UNIQUE INDEX `ubicacion_sector_estante_posicion` ON `ubicacion` (`sector`,`estante`,`posicion`);--> statement-breakpoint
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
	`pin_rapido` text,
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
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuario_preferencias_usuario_id_unique` ON `usuario_preferencias` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `lista_precio` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	`tipo` text DEFAULT 'general' NOT NULL,
	`ajuste_porcentual` real DEFAULT 0 NOT NULL,
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
CREATE TABLE `lista_precio_detalle` (
	`id` text PRIMARY KEY NOT NULL,
	`lista_precio_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`ajuste_porcentual` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cliente` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_documento` text NOT NULL,
	`numero_documento` text NOT NULL,
	`razon_social` text NOT NULL,
	`nombre_fantasia` text,
	`condicion_fiscal` text NOT NULL,
	`domicilio` text,
	`localidad` text,
	`provincia` text,
	`codigo_postal` text,
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
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action
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
	`localidad` text,
	`provincia` text,
	`codigo_postal` text,
	`telefono` text,
	`email` text,
	`persona_contacto` text,
	`observaciones` text,
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
	`forma_pago` text NOT NULL,
	`estado` text DEFAULT 'borrador' NOT NULL,
	`comprobante_id` text,
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
CREATE TABLE `venta_detalle` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`descripcion` text NOT NULL,
	`cantidad` real NOT NULL,
	`precio_unitario` real NOT NULL,
	`descuento_linea` real DEFAULT 0 NOT NULL,
	`alicuota_iva` real NOT NULL,
	`subtotal` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`venta_id`) REFERENCES `venta`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON UPDATE no action ON DELETE no action
);
