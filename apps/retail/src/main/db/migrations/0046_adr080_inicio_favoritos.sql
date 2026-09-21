-- ADR-080 (PERF-1) — Inicio personalizable + favoritos por usuario.
-- Aditiva y retrocompatible: agrega dos columnas a `usuario_preferencias` y siembra el
-- flag apagado. `pantalla_inicio` NULL = "usar el default por rol". `favoritos` es un
-- array JSON de paths de navegación (default '[]'). El flag termina en `_habilitado` para
-- que Funcionalidades (ADR-061) lo auto-descubra; queda en 'false' → cero cambio de
-- comportamiento hasta prenderlo.
ALTER TABLE `usuario_preferencias` ADD `pantalla_inicio` text;
--> statement-breakpoint
ALTER TABLE `usuario_preferencias` ADD `favoritos` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('inicio_personalizable_habilitado', 'false', 'bool', 'Inicio personalizable por usuario: pantalla de inicio configurable y favoritos en el sidebar (PERF-1).')
ON CONFLICT(`clave`) DO NOTHING;
