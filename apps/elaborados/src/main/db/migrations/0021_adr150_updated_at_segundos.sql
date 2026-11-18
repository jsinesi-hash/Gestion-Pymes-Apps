-- ADR-150 §5 (F2 PR1) — `updated_at` en segundos en todas las tablas que sincronizan. Algunas filas
-- quedaron en milisegundos: Consumidor Final (sembrado por la 0003 con strftime * 1000) y claves de
-- configuración del negocio que la 0058 copió de `parametros_sistema`, que guardaba milisegundos. El hub
-- resuelve last-write-wins comparando `updated_at`: una fila en milisegundos le ganaría siempre a
-- cualquier cambio posterior. Un valor mayor a 10^11 no puede ser segundos (año 5138).
UPDATE `articulo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `caja` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `categoria_venta` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `cliente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `compra` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `compra_item` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `comprobante` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `configuracion_negocio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `cuenta_corriente_cliente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `demo_registro` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `existencia_articulo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `grupo_modificador` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `grupo_modificador_opcion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `impuesto` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `lista_precio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_articulo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_caja` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `movimiento_cuenta_corriente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `permiso` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `produccion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_venta` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_venta_componente` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_venta_grupo` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `producto_venta_precio` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `proveedor` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `receta_produccion` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `receta_produccion_item` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol_permiso` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `rol_permiso_override` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `usuario` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `usuario_preferencias` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta_linea` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta_linea_modificador` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
--> statement-breakpoint
UPDATE `venta_pago` SET `updated_at` = `updated_at` / 1000 WHERE `updated_at` > 100000000000;
