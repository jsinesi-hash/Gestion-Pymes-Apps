-- ADR-157 (PR-C2) — Venta, comprobante y líneas en centavos. Convierte en el lugar: agrega *_centavos,
-- copia ROUND(pesos * 100) y retira la columna en pesos. venta.descuento_global es porcentaje y no cambia.
ALTER TABLE `venta` ADD `subtotal_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `venta` ADD `importe_iva_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `venta` ADD `total_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `venta` ADD `ajuste_redondeo_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `venta` SET
  `subtotal_centavos` = CAST(ROUND(`subtotal` * 100) AS INTEGER),
  `importe_iva_centavos` = CAST(ROUND(`importe_iva` * 100) AS INTEGER),
  `total_centavos` = CAST(ROUND(`total` * 100) AS INTEGER),
  `ajuste_redondeo_centavos` = CAST(ROUND(`ajuste_redondeo` * 100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `venta` DROP COLUMN `subtotal`;
--> statement-breakpoint
ALTER TABLE `venta` DROP COLUMN `importe_iva`;
--> statement-breakpoint
ALTER TABLE `venta` DROP COLUMN `total`;
--> statement-breakpoint
ALTER TABLE `venta` DROP COLUMN `ajuste_redondeo`;
--> statement-breakpoint
ALTER TABLE `comprobante` ADD `importe_neto_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `comprobante` ADD `importe_iva_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `comprobante` ADD `importe_total_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `comprobante` SET
  `importe_neto_centavos` = CAST(ROUND(`importe_neto` * 100) AS INTEGER),
  `importe_iva_centavos` = CAST(ROUND(`importe_iva` * 100) AS INTEGER),
  `importe_total_centavos` = CAST(ROUND(`importe_total` * 100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `comprobante` DROP COLUMN `importe_neto`;
--> statement-breakpoint
ALTER TABLE `comprobante` DROP COLUMN `importe_iva`;
--> statement-breakpoint
ALTER TABLE `comprobante` DROP COLUMN `importe_total`;
