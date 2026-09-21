-- Equivalente SQL de dev-seed/catalog.ts
-- Solo referencia/auditoría — no ejecutar directamente.
-- Nota: IDs reales son UUID generados con randomUUID() en TypeScript.
--       Se usa lower(hex(randomblob(16))) como equivalente SQLite.

-- ── Impuestos extra ────────────────────────────────────────────────────────────
-- El IVA 21% (predeterminado=1) lo inserta la migración 0000_init.sql.
-- seedCatalog agrega estos dos adicionales:
INSERT INTO impuesto (id, nombre, tipo, alicuota, predeterminado, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at)
VALUES
  (lower(hex(randomblob(16))), 'IVA 10.5%', 'iva',    10.5, 0, 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Exento',    'exento',  0.0, 0, 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Categorías raíz (5) ────────────────────────────────────────────────────────
INSERT INTO categoria (id, nombre, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'Herramientas', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Fijaciones',   1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Pintura',      1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Electricidad', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Plomería',     1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Subcategorías (10) ────────────────────────────────────────────────────────
-- categoria_padre_id resuelto dinámicamente en TypeScript (catIds lookup).
INSERT INTO categoria (id, nombre, categoria_padre_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'Herramientas Manuales',   '<id_Herramientas>',  1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Herramientas Eléctricas', '<id_Herramientas>',  1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Tornillos y Bulones',     '<id_Fijaciones>',    1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Anclajes y Tarugos',      '<id_Fijaciones>',    1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Pinturas y Esmaltes',     '<id_Pintura>',       1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Accesorios de Pintura',   '<id_Pintura>',       1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Cables y Conductores',    '<id_Electricidad>',  1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Iluminación',             '<id_Electricidad>',  1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Caños y Conexiones',      '<id_Plomería>',      1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Llaves y Válvulas',       '<id_Plomería>',      1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Marcas (6) ────────────────────────────────────────────────────────────────
INSERT INTO marca (id, nombre, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'Stanley',    1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Bosch',      1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Tramontina', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Plavicon',   1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Philips',    1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'Ferrum',     1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Ubicaciones (18) ──────────────────────────────────────────────────────────
-- Sector A, estante 01, posiciones 01-06 (6 filas)
-- Sector A, estante 02, posiciones 01-06 (6 filas)
-- Sector B, estante 01, posiciones 01-03 (3 filas)
-- Sector B, estante 02, posiciones 01-03 (3 filas)
INSERT INTO ubicacion (id, codigo, sector, estante, posicion, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'A-01-01', 'A', '01', '01', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-01-02', 'A', '01', '02', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-01-03', 'A', '01', '03', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-01-04', 'A', '01', '04', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-01-05', 'A', '01', '05', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-01-06', 'A', '01', '06', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-01', 'A', '02', '01', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-02', 'A', '02', '02', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-03', 'A', '02', '03', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-04', 'A', '02', '04', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-05', 'A', '02', '05', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'A-02-06', 'A', '02', '06', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-01-01', 'B', '01', '01', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-01-02', 'B', '01', '02', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-01-03', 'B', '01', '03', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-02-01', 'B', '02', '01', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-02-02', 'B', '02', '02', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'B-02-03', 'B', '02', '03', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Productos (35) ────────────────────────────────────────────────────────────
-- Todos usan IVA 21% (predeterminado), moneda ARS, permite_fraccion=0.
-- codigo_qr = 'QR-' || sku  (ej. 'QR-P-001')
-- Edge cases:
--   Sin stock (stock_fisico=0):         P-006, P-010, P-024
--   Bajo mínimo (0 < stock < min):      P-005, P-011, P-015, P-020, P-023
--   Inactivo (activo=0):                P-032
--   Factor de conversión 12 (caja→u):  P-012, P-014
--
-- Herramientas Manuales (7) — ubicaciones A-01-01..A-01-06, A-02-01
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-001', 'QR-P-001', '7790001000011', 'Martillo 500g',         'Martillo carpintero 500g mango de madera',           'unidad', NULL, 1, 0,  2500,  4235,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Stanley>',    '<id_A-01-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-002', 'QR-P-002', '7790001000028', 'Destornillador PH2',    'Destornillador Phillips PH2 mango bimaterial',      'unidad', NULL, 1, 0,   800,  1355,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Stanley>',    '<id_A-01-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-003', 'QR-P-003', NULL,            'Alicate 8"',            'Alicate universal 8 pulgadas corte lateral',         'unidad', NULL, 1, 0,  1500,  2541,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Tramontina>', '<id_A-01-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-004', 'QR-P-004', NULL,            'Llave ajustable 12"',   'Llave inglesa ajustable 12 pulgadas cromada',        'unidad', NULL, 1, 0,  3200,  5421,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Stanley>',    '<id_A-01-04>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-005', 'QR-P-005', NULL,            'Cinta métrica 5m',      'Cinta métrica retráctil 5m x 19mm',                 'unidad', NULL, 1, 0,   600,  1016,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Stanley>',    '<id_A-01-05>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),  -- bajo mínimo
  (lower(hex(randomblob(16))), 'P-006', 'QR-P-006', NULL,            'Sierra manual 20"',     'Sierra manual 20 pulgadas dientes endurecidos',      'unidad', NULL, 1, 0,  2800,  4743,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Tramontina>', '<id_A-01-06>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),  -- sin stock
  (lower(hex(randomblob(16))), 'P-007', 'QR-P-007', NULL,            'Nivel burbuja 60cm',    'Nivel de burbuja aluminio 60cm 3 viales',            'unidad', NULL, 1, 0,  1800,  3049,   '<id_iva21>', 'ARS', '<id_Herramientas Manuales>',   '<id_Bosch>',      '<id_A-02-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- Herramientas Eléctricas (4) — ubicaciones A-02-02..A-02-05
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-008', 'QR-P-008', '7790002000015', 'Taladro percutor 550W', 'Taladro percutor 550W mandril 13mm con maletín',     'unidad', NULL, 1, 0, 12000, 20328,   '<id_iva21>', 'ARS', '<id_Herramientas Eléctricas>', '<id_Bosch>',      '<id_A-02-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-009', 'QR-P-009', '7790002000022', 'Amoladora 4½" 850W',    'Amoladora angular 4.5 pulgadas 850W',                'unidad', NULL, 1, 0,  9500, 16093,   '<id_iva21>', 'ARS', '<id_Herramientas Eléctricas>', '<id_Bosch>',      '<id_A-02-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-010', 'QR-P-010', NULL,            'Atornillador 12V',      'Atornillador inalámbrico 12V 2 baterías maletín',    'unidad', NULL, 1, 0,  8000, 13552,   '<id_iva21>', 'ARS', '<id_Herramientas Eléctricas>', '<id_Bosch>',      '<id_A-02-04>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),  -- sin stock
  (lower(hex(randomblob(16))), 'P-011', 'QR-P-011', NULL,            'Sierra caladora 500W',  'Sierra caladora 500W 3000rpm con accesorios',        'unidad', NULL, 1, 0, 11000, 18634,   '<id_iva21>', 'ARS', '<id_Herramientas Eléctricas>', '<id_Bosch>',      '<id_A-02-05>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);  -- bajo mínimo

-- Tornillos y Bulones (6) — ubicaciones A-02-06, B-01-01..B-01-03, B-02-01..B-02-02
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-012', 'QR-P-012', '7790003000012', 'Tornillo cab.plana 3x25',  'Tornillo cabeza plana Phillips 3x25mm caja 12u',    'unidad', 'caja', 12, 0,    4,   6.78, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_A-02-06>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-013', 'QR-P-013', '7790003000029', 'Bulón hex M8x50',          'Bulón hexagonal M8x50mm zincado con tuerca',        'unidad', NULL,   1, 0,   12,  20.33, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_B-01-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-014', 'QR-P-014', NULL,            'Tornillo autop. 6x3/4"',   'Tornillo autoperforante cab.hex 6x3/4" caja 12u',   'unidad', 'caja', 12, 0,    3,   5.08, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_B-01-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-015', 'QR-P-015', NULL,            'Tuerca hex M8',            'Tuerca hexagonal M8 zincada DIN 934',               'unidad', NULL,   1, 0,    5,   8.47, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_B-01-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),  -- bajo mínimo
  (lower(hex(randomblob(16))), 'P-016', 'QR-P-016', NULL,            'Arandela plana M8',        'Arandela plana M8 zincada DIN 125',                 'unidad', NULL,   1, 0,    3,   5.08, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_B-02-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-017', 'QR-P-017', NULL,            'Arandela presión M8',      'Arandela de presión M8 muelle zincada',             'unidad', NULL,   1, 0,  3.5,   5.93, '<id_iva21>', 'ARS', '<id_Tornillos y Bulones>',     '<id_Tramontina>', '<id_B-02-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- Anclajes y Tarugos (3) — ubicaciones B-02-03, A-01-01, A-01-02
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-018', 'QR-P-018', NULL, 'Tarugo plástico 8mm',   'Tarugo plástico nylon 8mm con tornillo incluido',       'unidad', NULL, 1, 0,   8,  13.55, '<id_iva21>', 'ARS', '<id_Anclajes y Tarugos>', '<id_Tramontina>', '<id_B-02-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-019', 'QR-P-019', NULL, 'Anclaje mecánico M10',  'Anclaje mecánico expansivo M10 acero galvanizado',       'unidad', NULL, 1, 0,  45,  76.22, '<id_iva21>', 'ARS', '<id_Anclajes y Tarugos>', '<id_Tramontina>', '<id_A-01-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-020', 'QR-P-020', NULL, 'Bulón hormigón M12',    'Bulón para hormigón M12x90mm con tuerca y arandela',     'unidad', NULL, 1, 0,  65, 110.07, '<id_iva21>', 'ARS', '<id_Anclajes y Tarugos>', '<id_Tramontina>', '<id_A-01-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);  -- bajo mínimo

-- Pinturas y Esmaltes (4) — ubicaciones A-01-03..A-01-06
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-021', 'QR-P-021', '7790004000010', 'Látex blanco 4L',        'Pintura látex interior/exterior blanco 4 litros',     'litro',  NULL, 1, 0,  2800,  4743, '<id_iva21>', 'ARS', '<id_Pinturas y Esmaltes>', '<id_Plavicon>', '<id_A-01-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-022', 'QR-P-022', '7790004000027', 'Esmalte negro mate 1L',  'Esmalte sintético negro mate 1 litro alta cobertura', 'litro',  NULL, 1, 0,  1800,  3049, '<id_iva21>', 'ARS', '<id_Pinturas y Esmaltes>', '<id_Plavicon>', '<id_A-01-04>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-023', 'QR-P-023', NULL,            'Fondo anticorrosivo 4L', 'Fondo anticorrosivo gris 4 litros base solvente',     'litro',  NULL, 1, 0,  3200,  5421, '<id_iva21>', 'ARS', '<id_Pinturas y Esmaltes>', '<id_Plavicon>', '<id_A-01-05>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),  -- bajo mínimo
  (lower(hex(randomblob(16))), 'P-024', 'QR-P-024', NULL,            'Barniz marino 1L',       'Barniz marino brillante 1 litro UV resistente',       'litro',  NULL, 1, 0,  1500,  2541, '<id_iva21>', 'ARS', '<id_Pinturas y Esmaltes>', '<id_Plavicon>', '<id_A-01-06>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);  -- sin stock

-- Accesorios de Pintura (3) — ubicaciones A-02-01..A-02-03
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-025', 'QR-P-025', NULL, 'Rodillo lana 23cm',  'Rodillo de lana 23cm con mango extensible',              'unidad', NULL, 1, 0,  450,  762, '<id_iva21>', 'ARS', '<id_Accesorios de Pintura>', '<id_Tramontina>', '<id_A-02-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-026', 'QR-P-026', NULL, 'Pincel cerda 2"',    'Pincel cerda natural 2 pulgadas mango plástico',          'unidad', NULL, 1, 0,  180,  305, '<id_iva21>', 'ARS', '<id_Accesorios de Pintura>', '<id_Tramontina>', '<id_A-02-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-027', 'QR-P-027', NULL, 'Bandeja rodillo',    'Bandeja para rodillo plástica 23cm con rejilla',          'unidad', NULL, 1, 0,  250,  423, '<id_iva21>', 'ARS', '<id_Accesorios de Pintura>', '<id_Tramontina>', '<id_A-02-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- Cables y Conductores (3) — ubicaciones A-02-04..A-02-06
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-028', 'QR-P-028', '7790005000018', 'Cable unipolar 1.5mm²', 'Cable unipolar flexible 1.5mm² rojo IRAM 2183',       'metro',  NULL, 1, 0, 180,  305, '<id_iva21>', 'ARS', '<id_Cables y Conductores>', '<id_Philips>', '<id_A-02-04>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-029', 'QR-P-029', NULL,            'Cable bipolar 2.5mm²',  'Cable bipolar plano 2.5mm² blanco IRAM 2183',         'metro',  NULL, 1, 0, 350,  593, '<id_iva21>', 'ARS', '<id_Cables y Conductores>', '<id_Philips>', '<id_A-02-05>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-030', 'QR-P-030', NULL,            'Cinta aisladora 20m',   'Cinta aisladora PVC negra 20m -10°C a +80°C',         'unidad', NULL, 1, 0, 350,  593, '<id_iva21>', 'ARS', '<id_Cables y Conductores>', '<id_Philips>', '<id_A-02-06>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- Iluminación (2) — ubicaciones B-01-01..B-01-02
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-031', 'QR-P-031', '7790006000011', 'Lámpara LED 9W E27',      'Lámpara LED bulbo 9W E27 6500K luz fría 810lm',        'unidad', NULL, 1, 0,  850,  1440, '<id_iva21>', 'ARS', '<id_Iluminación>', '<id_Philips>', '<id_B-01-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-032', 'QR-P-032', NULL,            'Luminaria estanca 2x36W', 'Luminaria estanca fluorescente 2x36W IP65',             'unidad', NULL, 1, 0, 4500,  7623, '<id_iva21>', 'ARS', '<id_Iluminación>', '<id_Philips>', '<id_B-01-02>', 0, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);  -- inactivo (activo=0)

-- Caños y Conexiones (2) — ubicaciones B-01-03, B-02-01
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-033', 'QR-P-033', NULL, 'Caño PVC 3/4" 3m',  'Caño PVC sanitario presión 3/4 pulgada x 3 metros',     'unidad', NULL, 1, 0,  780, 1321, '<id_iva21>', 'ARS', '<id_Caños y Conexiones>', '<id_Ferrum>', '<id_B-01-03>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'P-034', 'QR-P-034', NULL, 'Codo PVC 90° 3/4"', 'Codo PVC 90 grados 3/4 pulgada rosca interna',           'unidad', NULL, 1, 0,  120,  203, '<id_iva21>', 'ARS', '<id_Caños y Conexiones>', '<id_Ferrum>', '<id_B-02-01>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- Llaves y Válvulas (1) — ubicación B-02-02
INSERT INTO producto (id, sku, codigo_qr, gtin_barcode, nombre_corto, nombre_largo, unidad_venta, unidad_compra, factor_conversion, permite_fraccion, precio_costo_promedio, precio_venta_lista, impuesto_id, moneda, categoria_id, marca_id, ubicacion_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at) VALUES
  (lower(hex(randomblob(16))), 'P-035', 'QR-P-035', NULL, 'Válvula esfera 1/2"', 'Válvula esfera 1/2 pulgada bronce hembra-hembra', 'unidad', NULL, 1, 0, 1200, 2033, '<id_iva21>', 'ARS', '<id_Llaves y Válvulas>', '<id_Ferrum>', '<id_B-02-02>', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Existencias (35 — una por producto) ──────────────────────────────────────
-- stock_reservado y stock_en_transito = NULL (futuro).
-- Resumen de stock_fisico / stock_minimo por SKU:
--   P-001: 15/5   P-002: 20/5   P-003: 12/5   P-004: 8/3    P-005: 2/8*
--   P-006: 0/3    P-007: 6/3    P-008: 4/2    P-009: 5/2    P-010: 0/2
--   P-011: 1/3*   P-012: 500/100 P-013: 300/50 P-014: 450/100 P-015: 30/100*
--   P-016: 200/50 P-017: 180/50 P-018: 150/50 P-019: 80/20  P-020: 3/15*
--   P-021: 25/10  P-022: 18/8   P-023: 2/5*   P-024: 0/5    P-025: 30/10
--   P-026: 40/15  P-027: 25/10  P-028: 200/50 P-029: 150/50 P-030: 60/20
--   P-031: 35/10  P-032: 8/2    P-033: 20/8   P-034: 45/15  P-035: 15/5
-- (* = bajo mínimo)
INSERT INTO existencias (id, producto_id, stock_fisico, stock_minimo, ultima_fecha_movimiento, version, origin_id, sync_state, updated_at)
VALUES
  (lower(hex(randomblob(16))), '<id_P-001>', 15,  5,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-002>', 20,  5,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-003>', 12,  5,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-004>',  8,  3,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-005>',  2,  8,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-006>',  0,  3,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-007>',  6,  3,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-008>',  4,  2,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-009>',  5,  2,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-010>',  0,  2,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-011>',  1,  3,   unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-012>', 500, 100, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-013>', 300,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-014>', 450, 100, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-015>',  30, 100, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-016>', 200,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-017>', 180,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-018>', 150,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-019>',  80,  20, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-020>',   3,  15, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-021>',  25,  10, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-022>',  18,   8, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-023>',   2,   5, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-024>',   0,   5, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-025>',  30,  10, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-026>',  40,  15, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-027>',  25,  10, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-028>', 200,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-029>', 150,  50, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-030>',  60,  20, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-031>',  35,  10, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-032>',   8,   2, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-033>',  20,   8, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-034>',  45,  15, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), '<id_P-035>',  15,   5, unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Movimientos de stock iniciales (35 — uno por producto) ───────────────────
-- tipo='entrada', motivo='inicial', referencia_tipo='seed', referencia_id='dev-seed'
-- costo_unitario = precio_costo_promedio del producto, stock_resultante = stock_fisico
-- (los de stock_fisico=0 tienen cantidad=0 y stock_resultante=0)
-- No se listan individualmente por brevedad; la estructura es idéntica para los 35:
--   INSERT INTO movimiento_stock (id, producto_id, tipo, motivo, cantidad,
--     stock_resultante, costo_unitario, referencia_tipo, referencia_id, usuario_id, fecha,
--     version, origin_id, sync_state, updated_at)
--   VALUES (lower(hex(randomblob(16))), '<id_P-NNN>', 'entrada', 'inicial',
--     <stock_fisico>, <stock_fisico>, <costo>, 'seed', 'dev-seed', 'system',
--     unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT 'impuestos'          AS tabla, COUNT(*) AS total FROM impuesto
UNION ALL SELECT 'categorias',        COUNT(*) FROM categoria
UNION ALL SELECT 'marcas',            COUNT(*) FROM marca
UNION ALL SELECT 'ubicaciones',       COUNT(*) FROM ubicacion
UNION ALL SELECT 'productos',         COUNT(*) FROM producto
UNION ALL SELECT 'existencias',       COUNT(*) FROM existencias
UNION ALL SELECT 'movimientos_stock', COUNT(*) FROM movimiento_stock;
-- Esperado: impuestos=3, categorias=15, marcas=6, ubicaciones=18,
--           productos=35, existencias=35, movimientos_stock=35

-- ── Stock edge cases ──────────────────────────────────────────────────────────
SELECT p.sku, p.nombre_corto, e.stock_fisico, e.stock_minimo,
  CASE
    WHEN e.stock_fisico = 0              THEN 'sin_stock'
    WHEN e.stock_fisico < e.stock_minimo THEN 'bajo_minimo'
    ELSE                                      'normal'
  END AS estado_stock,
  p.activo
FROM producto p
JOIN existencias e ON e.producto_id = p.id
ORDER BY p.sku;
-- sin_stock:   P-006, P-010, P-024
-- bajo_minimo: P-005, P-011, P-015, P-020, P-023
-- inactivo:    P-032 (activo=0, stock normal)
