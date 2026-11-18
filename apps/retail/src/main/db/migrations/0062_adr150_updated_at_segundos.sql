-- ADR-150 §5 (F2 PR1) — `updated_at` en segundos en todas las tablas que sincronizan. Algunas filas
-- quedaron en milisegundos: Consumidor Final (sembrado por la 0003 con strftime * 1000) y claves de
-- configuración del negocio que la 0058 copió de `parametros_sistema`, que guardaba milisegundos. El hub
-- resuelve last-write-wins comparando `updated_at`: una fila en milisegundos le ganaría siempre a
-- cualquier cambio posterior. Un valor mayor a 10^11 no puede ser segundos (año 5138).
UPDATE `agenda_evento` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `caja` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `cambio_programado` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `categoria` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `cliente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `comprobante` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `comprobante_compra` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `configuracion_negocio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `cuenta_corriente_cliente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `existencias` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `importacion_catalogo_proveedor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `importacion_catalogo_proveedor_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `importacion_costo_proveedor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `importacion_costo_proveedor_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `impuesto` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `item_oc` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `lista_precio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `lista_precio_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `lista_precio_valor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `marca` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_caja` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_cuenta_corriente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_stock` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `orden_compra` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `permiso` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `presupuesto` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `presupuesto_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `price_batch` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `price_batch_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_equivalencia` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_presentacion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_proveedor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `promocion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `proveedor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `proveedor_importacion_config` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `recalculo_masivo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `recepcion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `recepcion_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `regla_precio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `remito` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `remito_linea` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol_permiso` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol_permiso_override` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rutina` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `sinonimo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `transportista` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `ubicacion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `unidad` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `usuario` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `usuario_preferencias` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta_detalle` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta_pago` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
