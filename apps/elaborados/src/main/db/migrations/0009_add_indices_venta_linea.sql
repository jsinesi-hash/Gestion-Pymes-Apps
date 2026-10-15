CREATE INDEX `idx_venta_linea_venta_id` ON `venta_linea` (`venta_id`);--> statement-breakpoint
CREATE INDEX `idx_venta_linea_modificador_linea_id` ON `venta_linea_modificador` (`venta_linea_id`);