-- ADR-136 — Vigencia de la contraseña (30 días). Aditiva y retrocompatible.
-- `password_changed_at` guarda el último cambio de contraseña (timestamp Unix en segundos, como el
-- resto de las fechas). Los usuarios existentes parten de hoy: nadie queda bloqueado de golpe y su
-- plazo de 30 días empieza el día de esta migración.
ALTER TABLE `usuario` ADD `password_changed_at` integer;--> statement-breakpoint
UPDATE `usuario` SET `password_changed_at` = CAST(strftime('%s', 'now') AS integer) WHERE `password_changed_at` IS NULL;
