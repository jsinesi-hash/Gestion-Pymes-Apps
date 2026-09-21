-- ADR-049 Fase 1 — Costo neto: componentes comerciales.
-- Aditiva y retrocompatible: todos los defaults en 0 / NULL => costo neto = costo bruto,
-- el comportamiento de precios no cambia. Todo el motor v2 va detras del flag
-- motor_precios_v2_habilitado (default false).

-- Defaults comerciales por proveedor (ADR-049 §1). Overridables por producto.
ALTER TABLE `proveedor` ADD COLUMN `bonificacion_pct_default` REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `proveedor` ADD COLUMN `costo_financiero_pct_default` REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `proveedor` ADD COLUMN `flete_pct_default` REAL NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Overrides comerciales por producto-proveedor (NULL = hereda del proveedor).
-- flete_centavos es el override ABSOLUTO (peso/volumen) que pisa a flete_pct.
ALTER TABLE `producto_proveedor` ADD COLUMN `bonificacion_pct` REAL;
--> statement-breakpoint
ALTER TABLE `producto_proveedor` ADD COLUMN `costo_financiero_pct` REAL;
--> statement-breakpoint
ALTER TABLE `producto_proveedor` ADD COLUMN `flete_pct` REAL;
--> statement-breakpoint
ALTER TABLE `producto_proveedor` ADD COLUMN `flete_centavos` INTEGER;
--> statement-breakpoint
ALTER TABLE `producto_proveedor` ADD COLUMN `otros_costos_centavos` INTEGER;
--> statement-breakpoint

-- Feature flag del Motor de Precios v2 (ADR-044/049). Default false.
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('motor_precios_v2_habilitado', 'false', 'bool', 'Feature flag del Motor de Precios v2 (ADR-049). Default false.');
