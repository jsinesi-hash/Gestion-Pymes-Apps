-- ADR-150 §7 (F1 PR4c) — Lápidas en ítems de receta y en líneas de pedido. Aditiva (columnas nullable).
ALTER TABLE `receta_produccion_item` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `venta_linea` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `venta_linea_modificador` ADD `deleted_at` integer;
