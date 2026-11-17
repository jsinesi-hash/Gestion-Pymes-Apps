-- ADR-150 §7 (F1 PR4a) — Sin borrados físicos en tablas que sincronizan: lápidas. Aditiva (columnas nullable).
ALTER TABLE `rol_permiso` ADD `deleted_at` integer;
