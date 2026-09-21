-- ADR-073 — Búsqueda por similitud en Catálogo: flag de la feature en parametros_sistema.
-- Migración ADITIVA de datos: sólo inserta el flag (default false). No toca esquema.
-- La pantalla de Catálogo expone el modo "Buscar similares" detrás de este flag; el servicio
-- IPC `producto:buscarSimilares` reutiliza el matcher token-set de ADR-063 sobre
-- `nombre_corto_norm` (enmienda de normalizar(): unidad con espacio → pegada).
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('busqueda_similares_habilitado', 'false', 'bool', 'Búsqueda por similitud de nombre en Catálogo (token-set / ADR-063)');
