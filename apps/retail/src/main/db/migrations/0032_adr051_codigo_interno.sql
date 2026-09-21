-- ADR-051 (ajuste post-implementación): tercer identificador opcional de matching en
-- Importar Costos — columna de código de producto interno (SKU), además de EAN y
-- código de proveedor. Columna nullable, ADD COLUMN simple alcanza (sin CHECK ni FK).
ALTER TABLE `proveedor_importacion_config` ADD COLUMN `columna_codigo_interno` TEXT;
