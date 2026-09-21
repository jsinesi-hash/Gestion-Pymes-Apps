-- ADR-081 (PERF-2) — Vistos recientemente.
-- Siembra el flag de la feature APAGADO de fábrica. Aditiva y retrocompatible: sólo agrega
-- una fila a `parametros_sistema`. `parametros:set` es UPDATE-only, por eso el flag DEBE
-- existir como fila para poder togglearse desde Funcionalidades (ADR-061). Termina en
-- `_habilitado` para que esa pantalla lo auto-descubra como toggle. El store de recientes es
-- estado local por terminal (localStorage, sin sync ni backup); esta fila sólo gobierna si la
-- feature se registra y se muestra.
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('vistos_recientes_habilitado', 'false', 'bool', 'Muestra productos y clientes vistos recientemente (PERF-2).')
ON CONFLICT(`clave`) DO NOTHING;
