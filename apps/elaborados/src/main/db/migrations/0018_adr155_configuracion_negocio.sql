-- ADR-155 §1 (F1 PR7) — Configuración del negocio vs. de la terminal. Elaborados no tenía claves del
-- negocio (solo SMTP, que es de la terminal): crea la tabla y siembra `caja_modo`.
CREATE TABLE `configuracion_negocio` (
	`id` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`tipo` text NOT NULL,
	`descripcion` text,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `configuracion_negocio` (`id`, `valor`, `tipo`, `descripcion`, `origin_id`, `updated_at`)
VALUES ('caja_modo', 'por_terminal', 'string', 'Cómo trabajan las cajas: por_terminal (cada terminal su turno) o compartida (un turno para todo el negocio, solo con varias terminales)', COALESCE((SELECT `origin_id` FROM `usuario` ORDER BY `fecha_creacion` LIMIT 1), 'C1'), CAST(strftime('%s', 'now') AS INTEGER));
