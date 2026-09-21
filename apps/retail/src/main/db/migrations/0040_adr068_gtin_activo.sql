-- ADR-068: reuso de GTIN de presentación tras baja — condicionar ux_pp_gtin por activo.
-- Antes: UNIQUE (gtin_barcode) WHERE gtin_barcode IS NOT NULL (global — la baja no liberaba el código).
-- Ahora: sólo las presentaciones activas exigen GTIN único; la inactiva conserva el dato.
-- Recreación segura sin data-fix: el índice global vigente impide que hoy existan dos filas
-- con el mismo GTIN, así que no hay datos en conflicto al recrear el índice como parcial.
DROP INDEX `ux_pp_gtin`;
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_pp_gtin`
	ON `producto_presentacion` (`gtin_barcode`)
	WHERE `gtin_barcode` IS NOT NULL AND `activo` = 1;
