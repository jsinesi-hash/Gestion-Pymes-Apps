-- ADR-025: SKU opaco (P-NNNNNNN-C) + eliminacion de codigo_qr. Registros de prueba descartados.
DELETE FROM movimiento_stock WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM existencias WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM lista_precio_detalle WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM producto_proveedor WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM venta_detalle WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM recepcion_detalle WHERE item_oc_id IN (SELECT id FROM item_oc WHERE producto_id IN (SELECT id FROM producto));
--> statement-breakpoint
DELETE FROM item_oc WHERE producto_id IN (SELECT id FROM producto);
--> statement-breakpoint
DELETE FROM producto; -- NOSONAR: limpieza total intencional en migración ADR-025
--> statement-breakpoint
ALTER TABLE producto ADD COLUMN sku_secuencial INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
DROP INDEX IF EXISTS `producto_codigo_qr_unique`;
--> statement-breakpoint
ALTER TABLE producto DROP COLUMN codigo_qr;
--> statement-breakpoint
INSERT INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('sku_proximo_secuencial', '1', 'number', 'Proximo secuencial de SKU. Incrementado atomicamente en alta de producto. Single-node; multinodo diferido a R4.');
--> statement-breakpoint
CREATE VIEW IF NOT EXISTS producto_legible AS
SELECT p.id, p.sku, p.sku_secuencial, p.gtin_barcode,
       p.nombre_corto, p.nombre_largo,
       c.nombre AS categoria, m.nombre AS marca,
       u.codigo AS ubicacion, i.nombre AS impuesto, i.alicuota,
       p.precio_venta_lista, p.precio_costo_promedio, p.activo
FROM producto p
LEFT JOIN categoria  c ON p.categoria_id  = c.id
LEFT JOIN marca      m ON p.marca_id      = m.id
LEFT JOIN ubicacion  u ON p.ubicacion_id  = u.id
LEFT JOIN impuesto   i ON p.impuesto_id   = i.id;
