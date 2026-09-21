-- ADR-067 — Match de búsqueda acento-insensible para sinónimos.
-- Aditiva: agrega la columna `nombre_corto_norm` a `producto` (nullable). El backfill de
-- las filas existentes lo hace `backfillNombreCortoNorm` en el arranque (no se puede quitar
-- acentos en SQL puro). Las altas/ediciones/imports la mantienen normalizada.
ALTER TABLE `producto` ADD COLUMN `nombre_corto_norm` TEXT;
