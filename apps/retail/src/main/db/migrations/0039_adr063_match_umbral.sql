-- ADR-063 Lote 4 — Umbral opt-in de pre-selección por similitud, por proveedor.
-- Aditiva: agrega la columna nullable `match_umbral_preseleccion` (INTEGER 0-100, null =
-- desactivado, default null). Sólo cambia el estado inicial del preview de importación
-- (pre-marca los aciertos de alta similitud); nunca hay escritura sin confirmación humana.
ALTER TABLE `proveedor` ADD COLUMN `match_umbral_preseleccion` INTEGER;
