-- ADR-079 (SEC-3) — Auto-bloqueo por inactividad.
-- Siembra los dos parámetros de configuración. Aditiva y retrocompatible: sólo agrega
-- filas a `parametros_sistema`. Ambos se crean APAGADOS de fábrica
-- (`bloqueo_inactividad_habilitado` = 'false'), así que el comportamiento no cambia hasta
-- que un Supervisor lo prenda desde Funcionalidades (ADR-061). `parametros:set` es
-- UPDATE-only, por eso el flag DEBE existir como fila para poder togglearse.
-- El flag booleano termina en `_habilitado` para que la pantalla de Funcionalidades lo
-- auto-descubra como toggle. El umbral de minutos es un `number` aparte (default 15).
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('bloqueo_inactividad_habilitado', 'false', 'bool', 'Auto-bloqueo por inactividad: pide la contraseña para retomar (SEC-3).')
ON CONFLICT(`clave`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('bloqueo_inactividad_minutos', '15', 'number', 'Minutos de inactividad antes del auto-bloqueo (SEC-3).')
ON CONFLICT(`clave`) DO NOTHING;
