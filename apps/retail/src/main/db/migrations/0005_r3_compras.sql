CREATE TABLE `producto_proveedor` (
    `id`                  text PRIMARY KEY NOT NULL,
    `producto_id`         text NOT NULL,
    `proveedor_id`        text NOT NULL,
    `costo_centavos`      integer NOT NULL DEFAULT 0,
    `codigo_proveedor`    text,
    `preferido`           integer NOT NULL DEFAULT false,
    `usuario_creacion_id` text NOT NULL,
    `fecha_creacion`      integer NOT NULL,
    `version`             integer NOT NULL DEFAULT 1,
    `origin_id`           text NOT NULL,
    `sync_state`          text NOT NULL DEFAULT 'pending', -- NOSONAR: 'pending' literal repeated by design across sync tables
    `updated_at`          integer NOT NULL,
    FOREIGN KEY (`producto_id`)  REFERENCES `producto`(`id`),
    FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`)
);
--> statement-breakpoint
-- Un producto no puede tener el mismo proveedor dos veces
CREATE UNIQUE INDEX `pp_producto_proveedor_unique`
    ON `producto_proveedor` (`producto_id`, `proveedor_id`);
--> statement-breakpoint
-- Un solo proveedor puede ser preferido por producto
CREATE UNIQUE INDEX `pp_preferido_por_producto`
    ON `producto_proveedor` (`producto_id`) WHERE `preferido` = 1;
--> statement-breakpoint

CREATE TABLE `orden_compra` (
    `id`                      text PRIMARY KEY NOT NULL,
    `numero_interno`          text NOT NULL,
    `proveedor_id`            text NOT NULL,
    `tipo`                    text NOT NULL,
    `estado`                  text NOT NULL DEFAULT 'borrador',
    `fecha`                   integer NOT NULL,
    `fecha_entrega_estimada`  integer,
    `subtotal_centavos`       integer NOT NULL DEFAULT 0,
    `importe_iva_centavos`    integer NOT NULL DEFAULT 0,
    `total_centavos`          integer NOT NULL DEFAULT 0,
    `usuario_id`              text NOT NULL,
    `observaciones`           text,
    `usuario_creacion_id`     text NOT NULL,
    `fecha_creacion`          integer NOT NULL,
    `usuario_modificacion_id` text,
    `fecha_actualizacion`     integer,
    `version`                 integer NOT NULL DEFAULT 1,
    `origin_id`               text NOT NULL,
    `sync_state`              text NOT NULL DEFAULT 'pending',
    `updated_at`              integer NOT NULL,
    FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`),
    FOREIGN KEY (`usuario_id`)   REFERENCES `usuario`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_numero_interno_unique` ON `orden_compra` (`numero_interno`);
--> statement-breakpoint

CREATE TABLE `item_oc` (
    `id`                      text PRIMARY KEY NOT NULL,
    `orden_compra_id`         text NOT NULL,
    `producto_id`             text NOT NULL,
    `descripcion`             text NOT NULL,
    `cantidad_pedida`         real NOT NULL,
    `cantidad_recibida`       real NOT NULL DEFAULT 0,
    `costo_unitario_centavos` integer NOT NULL,
    `alicuota_iva`            real NOT NULL,
    `subtotal_centavos`       integer NOT NULL,
    `version`                 integer NOT NULL DEFAULT 1,
    `origin_id`               text NOT NULL,
    `sync_state`              text NOT NULL DEFAULT 'pending',
    `updated_at`              integer NOT NULL,
    FOREIGN KEY (`orden_compra_id`) REFERENCES `orden_compra`(`id`),
    FOREIGN KEY (`producto_id`)     REFERENCES `producto`(`id`)
);
--> statement-breakpoint

CREATE TABLE `recepcion` (
    `id`               text PRIMARY KEY NOT NULL,
    `orden_compra_id`  text NOT NULL,
    `fecha`            integer NOT NULL,
    `usuario_id`       text NOT NULL,
    `remito_proveedor` text,
    `observaciones`    text,
    `version`          integer NOT NULL DEFAULT 1,
    `origin_id`        text NOT NULL,
    `sync_state`       text NOT NULL DEFAULT 'pending',
    `updated_at`       integer NOT NULL,
    FOREIGN KEY (`orden_compra_id`) REFERENCES `orden_compra`(`id`),
    FOREIGN KEY (`usuario_id`)      REFERENCES `usuario`(`id`)
);
--> statement-breakpoint

CREATE TABLE `recepcion_detalle` (
    `id`                           text PRIMARY KEY NOT NULL,
    `recepcion_id`                 text NOT NULL,
    `item_oc_id`                   text NOT NULL,
    `cantidad_recibida`            real NOT NULL,
    `costo_unitario_real_centavos` integer,
    `version`                      integer NOT NULL DEFAULT 1,
    `origin_id`                    text NOT NULL,
    `sync_state`                   text NOT NULL DEFAULT 'pending',
    `updated_at`                   integer NOT NULL,
    FOREIGN KEY (`recepcion_id`) REFERENCES `recepcion`(`id`),
    FOREIGN KEY (`item_oc_id`)   REFERENCES `item_oc`(`id`)
);
--> statement-breakpoint

CREATE TABLE `comprobante_compra` (
    `id`                     text PRIMARY KEY NOT NULL,
    `recepcion_id`           text,
    `proveedor_id`           text NOT NULL,
    `tipo`                   text NOT NULL,
    `punto_venta`            integer,
    `numero`                 text,
    `fecha_emision`          integer NOT NULL,
    `importe_neto_centavos`  integer NOT NULL DEFAULT 0,
    `importe_iva_centavos`   integer NOT NULL DEFAULT 0,
    `importe_total_centavos` integer NOT NULL DEFAULT 0,
    `estado`                 text NOT NULL DEFAULT 'pendiente',
    `observaciones`          text,
    `version`                integer NOT NULL DEFAULT 1,
    `origin_id`              text NOT NULL,
    `sync_state`             text NOT NULL DEFAULT 'pending',
    `updated_at`             integer NOT NULL,
    FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`)
);
--> statement-breakpoint

CREATE TABLE `cuenta_corriente_cliente` (
    `id`                      text PRIMARY KEY NOT NULL,
    `cliente_id`              text NOT NULL,
    `saldo_centavos`          integer NOT NULL DEFAULT 0,
    `limite_credito_centavos` integer NOT NULL DEFAULT 0,
    `fecha_ultimo_movimiento` integer,
    `activo`                  integer NOT NULL DEFAULT true,
    `version`                 integer NOT NULL DEFAULT 1,
    `origin_id`               text NOT NULL,
    `sync_state`              text NOT NULL DEFAULT 'pending',
    `updated_at`              integer NOT NULL,
    FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ccc_cliente_id_unique` ON `cuenta_corriente_cliente` (`cliente_id`);
--> statement-breakpoint

CREATE TABLE `movimiento_cuenta_corriente` (
    `id`                        text PRIMARY KEY NOT NULL,
    `cuenta_id`                 text NOT NULL,
    `tipo`                      text NOT NULL,
    `motivo`                    text NOT NULL,
    `monto_centavos`            integer NOT NULL,
    `saldo_resultante_centavos` integer NOT NULL,
    `referencia_tipo`           text,
    `referencia_id`             text,
    `usuario_id`                text NOT NULL,
    `fecha`                     integer NOT NULL,
    `observaciones`             text,
    `version`                   integer NOT NULL DEFAULT 1,
    `origin_id`                 text NOT NULL,
    `sync_state`                text NOT NULL DEFAULT 'pending',
    `updated_at`                integer NOT NULL,
    FOREIGN KEY (`cuenta_id`)  REFERENCES `cuenta_corriente_cliente`(`id`),
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`)
);
--> statement-breakpoint

-- Correlativo de numeración de OC por terminal
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('oc_correlativo_C1', '0', 'number', 'Correlativo de órdenes de compra para terminal C1');
