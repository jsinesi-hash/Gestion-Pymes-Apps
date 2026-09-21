-- ADR-086 — Modos de la app (skin).
-- Aditiva y retrocompatible: agrega una columna a `usuario_preferencias`. El Tema manda el
-- color; el Modo, la geometría. `skin` reemplaza al control de Densidad en la UI: la columna
-- `densidad` se conserva pero pasa a derivarse del modo al aplicar al DOM
-- (maximizar→compact, resto→comfortable). Default 'actual' → cero cambio visual para
-- usuarios existentes hasta que elijan otro modo.
ALTER TABLE `usuario_preferencias` ADD `skin` text DEFAULT 'actual' NOT NULL;
