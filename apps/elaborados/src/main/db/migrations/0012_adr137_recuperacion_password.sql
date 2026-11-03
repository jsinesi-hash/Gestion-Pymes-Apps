-- ADR-137 — Códigos de recuperación de contraseña por mail. Aditiva y retrocompatible: tabla nueva.
-- Un solo uso, vencen a los 15 minutos y solo se guarda el hash del código.
CREATE TABLE `recuperacion_password` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`codigo_hash` text NOT NULL,
	`expira_en` integer NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`usado` integer DEFAULT false NOT NULL,
	`creado_en` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON UPDATE no action ON DELETE no action
);
