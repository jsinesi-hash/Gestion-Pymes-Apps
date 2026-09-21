-- ADR-078 — Encender el hub "Precios y Costos" de fábrica.
-- El flag `hub_precios_habilitado` se leía con default false y NO tenía fila en
-- `parametros_sistema` (a diferencia de otros flags, que se sembraban en 'false' y luego
-- 0035 los flipeaba). Acá se crea/actualiza en 'true' para que el hub venga ENCENDIDO en
-- instalaciones nuevas y existentes. Aditiva y retrocompatible: sólo toca datos.
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('hub_precios_habilitado', 'true', 'bool', 'Hub Precios/Costos con pestañas (ADR-078). Encendido de fabrica.')
ON CONFLICT(`clave`) DO UPDATE SET `valor` = 'true';
