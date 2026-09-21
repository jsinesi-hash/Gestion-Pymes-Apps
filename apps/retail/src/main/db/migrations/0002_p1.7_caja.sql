CREATE TABLE `parametros_sistema` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`tipo` text NOT NULL,
	`descripcion` text,
	`actualizado_en` integer,
	`actualizado_por` text,
	FOREIGN KEY (`actualizado_por`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `caja` ADD COLUMN `supervisor_autorizacion_id` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`) VALUES
  ('umbral_diferencia_caja', '50000', 'number', 'Diferencia máxima de efectivo en arqueo sin autorización del Supervisor');
