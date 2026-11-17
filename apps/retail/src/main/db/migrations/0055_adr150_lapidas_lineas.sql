-- ADR-150 §7 (F1 PR4b) — Lápidas en las líneas de documentos en borrador. Aditiva (columnas nullable).
ALTER TABLE `venta_detalle` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `presupuesto_detalle` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `remito_linea` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `item_oc` ADD `deleted_at` integer;
