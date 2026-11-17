-- ADR-157 (PR-C1) — Caja en centavos. Convierte en el lugar: agrega la columna *_centavos, copia
-- ROUND(pesos * 100) y retira la columna en pesos. Los montos no cambian, solo su unidad.
ALTER TABLE `caja` ADD `monto_inicial_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `caja` ADD `monto_esperado_centavos` integer;
--> statement-breakpoint
ALTER TABLE `caja` ADD `monto_contado_centavos` integer;
--> statement-breakpoint
ALTER TABLE `caja` ADD `diferencia_centavos` integer;
--> statement-breakpoint
UPDATE `caja` SET
  `monto_inicial_centavos`  = CAST(ROUND(`monto_inicial` * 100) AS INTEGER),
  `monto_esperado_centavos` = CASE WHEN `monto_esperado` IS NULL THEN NULL ELSE CAST(ROUND(`monto_esperado` * 100) AS INTEGER) END,
  `monto_contado_centavos`  = CASE WHEN `monto_contado` IS NULL THEN NULL ELSE CAST(ROUND(`monto_contado` * 100) AS INTEGER) END,
  `diferencia_centavos`     = CASE WHEN `diferencia` IS NULL THEN NULL ELSE CAST(ROUND(`diferencia` * 100) AS INTEGER) END;
--> statement-breakpoint
ALTER TABLE `caja` DROP COLUMN `monto_inicial`;
--> statement-breakpoint
ALTER TABLE `caja` DROP COLUMN `monto_esperado`;
--> statement-breakpoint
ALTER TABLE `caja` DROP COLUMN `monto_contado`;
--> statement-breakpoint
ALTER TABLE `caja` DROP COLUMN `diferencia`;
--> statement-breakpoint
ALTER TABLE `movimiento_caja` ADD `monto_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `movimiento_caja` SET `monto_centavos` = CAST(ROUND(`monto` * 100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `movimiento_caja` DROP COLUMN `monto`;
--> statement-breakpoint
-- El umbral se comparaba contra la diferencia en pesos (50000 = $ 50.000). Pasa a centavos con el
-- mismo valor en pesos y la clave lo dice en el nombre, como `arqueo_diferencia_alerta_centavos`.
UPDATE `configuracion_negocio` SET `id` = 'umbral_diferencia_caja_centavos',
  `valor` = CAST(ROUND(CAST(`valor` AS REAL) * 100) AS INTEGER),
  `descripcion` = 'Diferencia máxima de efectivo en el arqueo sin autorización del Supervisor (centavos)',
  `version` = `version` + 1, `sync_state` = 'pending', `updated_at` = CAST(strftime('%s', 'now') AS INTEGER)
WHERE `id` = 'umbral_diferencia_caja';
