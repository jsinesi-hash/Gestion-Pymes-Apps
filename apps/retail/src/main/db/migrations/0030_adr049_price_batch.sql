-- ADR-049 Fase 3 — Lote de publicación de precios (price_batch / price_batch_detalle).
-- Aditiva. Nada publica sin aprobación; el motor v2 sigue detrás del flag.

CREATE TABLE IF NOT EXISTS `price_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`lista_precio_id` text NOT NULL,
	`proveedor_id` text,
	`origen` text NOT NULL,
	`referencia_tipo` text,
	`referencia_id` text,
	`estado` text NOT NULL DEFAULT 'borrador',
	`batch_revertido_id` text,
	`productos_ok` integer NOT NULL DEFAULT 0,
	`advertencias` integer NOT NULL DEFAULT 0,
	`errores` integer NOT NULL DEFAULT 0,
	`excluidas` integer NOT NULL DEFAULT 0,
	`impacto_incremento_centavos` integer NOT NULL DEFAULT 0,
	`usuario_creacion_id` text NOT NULL,
	`usuario_aprobador_id` text,
	`fecha_creacion` integer NOT NULL,
	`fecha_aprobacion` integer,
	`fecha_publicacion` integer,
	`observaciones` text,
	`version` integer NOT NULL DEFAULT 1,
	`origin_id` text NOT NULL,
	`sync_state` text NOT NULL DEFAULT 'pending',
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_price_batch_lista` ON `price_batch` (`lista_precio_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_price_batch_estado` ON `price_batch` (`estado`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `price_batch_detalle` (
	`id` text PRIMARY KEY NOT NULL,
	`price_batch_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`presentacion_id` text,
	`costo_neto_centavos` integer,
	`precio_anterior_centavos` integer,
	`precio_propuesto_centavos` integer NOT NULL,
	`margen_anterior_pct` real,
	`margen_nuevo_pct` real,
	`regla_precio_id` text,
	`variacion_pct` real,
	`estado_validacion` text NOT NULL DEFAULT 'ok',
	`motivo_validacion` text,
	`version` integer NOT NULL DEFAULT 1,
	`origin_id` text NOT NULL,
	`sync_state` text NOT NULL DEFAULT 'pending',
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`price_batch_id`) REFERENCES `price_batch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_price_batch_detalle_batch` ON `price_batch_detalle` (`price_batch_id`);
--> statement-breakpoint

ALTER TABLE `recalculo_masivo` ADD COLUMN `price_batch_id` text REFERENCES `price_batch`(`id`);
--> statement-breakpoint

-- Umbrales del motor de validación (ADR-049 §5). Editables por Supervisor.
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion) VALUES
	('precios.variacion_maxima_pct', '30', 'number', 'Variación % sobre la que una fila del lote se marca advertencia (ADR-049).'),
	('precios.margen_minimo_pct', '0', 'number', 'Margen mínimo (markup) admitido; por debajo, la fila es error (ADR-049).'),
	('precios.excluir_manuales_dias_default', '0', 'number', 'Días por defecto para excluir precios manuales recientes al recalcular (ADR-049).');
