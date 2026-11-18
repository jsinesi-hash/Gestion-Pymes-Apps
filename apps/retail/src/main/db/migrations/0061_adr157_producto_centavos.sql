-- ADR-157 (PR-C3) — Precio de lista y costo del producto, y costo del libro de stock, en centavos.
-- Convierte en el lugar: agrega *_centavos, copia ROUND(pesos * 100) y retira la columna en pesos.
-- El costo promedio guardado se recalcula una vez desde el libro al arrancar (startup), para que
-- coincida con la proyección que redondea al centavo en cada entrada.
-- La vista producto_legible (0010) lee las columnas en pesos: se retira y se recrea en centavos.
DROP VIEW IF EXISTS `producto_legible`;
--> statement-breakpoint
ALTER TABLE `producto` ADD `precio_costo_promedio_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `producto` ADD `precio_venta_lista_centavos` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `producto` SET
  `precio_costo_promedio_centavos` = CAST(ROUND(`precio_costo_promedio` * 100) AS INTEGER),
  `precio_venta_lista_centavos` = CAST(ROUND(`precio_venta_lista` * 100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `producto` DROP COLUMN `precio_costo_promedio`;
--> statement-breakpoint
ALTER TABLE `producto` DROP COLUMN `precio_venta_lista`;
--> statement-breakpoint
ALTER TABLE `movimiento_stock` ADD `costo_unitario_centavos` integer;
--> statement-breakpoint
UPDATE `movimiento_stock` SET `costo_unitario_centavos` = CAST(ROUND(`costo_unitario` * 100) AS INTEGER)
  WHERE `costo_unitario` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `movimiento_stock` DROP COLUMN `costo_unitario`;
--> statement-breakpoint
CREATE VIEW IF NOT EXISTS producto_legible AS
SELECT p.id, p.sku, p.sku_secuencial, p.gtin_barcode,
       p.nombre_corto, p.nombre_largo,
       c.nombre AS categoria, m.nombre AS marca,
       u.codigo AS ubicacion, i.nombre AS impuesto, i.alicuota,
       p.precio_venta_lista_centavos, p.precio_costo_promedio_centavos, p.activo
FROM producto p
LEFT JOIN categoria  c ON p.categoria_id  = c.id
LEFT JOIN marca      m ON p.marca_id      = m.id
LEFT JOIN ubicacion  u ON p.ubicacion_id  = u.id
LEFT JOIN impuesto   i ON p.impuesto_id   = i.id;
