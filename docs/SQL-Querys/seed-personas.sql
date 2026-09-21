-- Equivalente SQL de dev-seed/personas.ts
-- Solo referencia/auditoría — no ejecutar directamente.
-- Nota: IDs reales son UUID generados con randomUUID() en TypeScript.
--       Se usa lower(hex(randomblob(16))) como equivalente SQLite.

-- ── Lista de precios Mayorista ─────────────────────────────────────────────────
-- ajuste_porcentual = 15 (con signo, positivo = incremento sobre lista)
INSERT INTO lista_precio (id, nombre, tipo, ajuste_porcentual, predeterminada, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at)
VALUES (lower(hex(randomblob(16))), 'Mayorista', 'especial', 15, 0, 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Clientes (8) ──────────────────────────────────────────────────────────────
-- El cliente "Consumidor Final" (id fixo: cf000000-0000-0000-0000-000000000001)
-- ya existe por la migración 0003 y NO se re-inserta aquí.
-- Total post-seed: 9 clientes (1 CF + 8 nuevos).
--
-- Campos omitidos (NULL): nombre_fantasia, domicilio, localidad, provincia, cp, email.
-- lista_precio_id: solo el último cliente (Grupo Constructor Andes) recibe <id_Mayorista>.
INSERT INTO cliente (id, tipo_documento, numero_documento, razon_social, condicion_fiscal, habilita_cuenta_corriente, telefono, lista_precio_id, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at)
VALUES
  (lower(hex(randomblob(16))), 'DNI',  '28456789',    'María González',            'Consumidor Final', 0, NULL,         NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'DNI',  '35678123',    'Pablo Romero',              'Consumidor Final', 0, NULL,         NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'DNI',  '41234567',    'Ana Laura Ferreyra',        'Consumidor Final', 0, NULL,         NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '20301234561', 'Construcciones Giménez',    'Monotributo',      0, '2614501234', NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '30456789012', 'Pinturas y Reformas SRL',   'Monotributo',      0, '2614509876', NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '30123456789', 'Constructora Del Norte SA', 'RI',               1, '2614512345', NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '20198765432', 'Ferretería El Martillo',    'RI',               1, '2614567890', NULL,               1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '30987654321', 'Grupo Constructor Andes',   'RI',               1, '2614598765', '<id_Mayorista>',   1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Proveedores (3) ───────────────────────────────────────────────────────────
-- Campos omitidos (NULL): nombre_fantasia, domicilio, localidad, provincia, cp, email, observaciones.
INSERT INTO proveedor (id, tipo_documento, numero_documento, razon_social, condicion_fiscal, persona_contacto, telefono, activo, usuario_creacion_id, fecha_creacion, version, origin_id, sync_state, updated_at)
VALUES
  (lower(hex(randomblob(16))), 'CUIT', '20456789013', 'Ferretería Don Roberto',    'Monotributo', 'Roberto Sánchez', '2614401234', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '30123789456', 'Distribuidora Metálica SA', 'RI',          'Lucía Peralta',   '2614412345', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000),
  (lower(hex(randomblob(16))), 'CUIT', '30987123654', 'Pinturas del Sur SA',       'RI',          'Diego Martínez',  '2614423456', 1, 'system', unixepoch()*1000, 1, 'system', 'synced', unixepoch()*1000);

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT 'clientes'    AS tabla, COUNT(*) AS total FROM cliente
UNION ALL SELECT 'proveedores', COUNT(*) FROM proveedor
UNION ALL SELECT 'listas',      COUNT(*) FROM lista_precio;
-- Esperado: clientes=9 (CF + 8 nuevos), proveedores=3, listas=1

-- Clientes con cuenta corriente habilitada
SELECT razon_social, condicion_fiscal, habilita_cuenta_corriente, lista_precio_id
FROM cliente
WHERE habilita_cuenta_corriente = 1
ORDER BY razon_social;
-- Esperado: Constructora Del Norte SA, Ferretería El Martillo, Grupo Constructor Andes (3 filas)
-- Solo Grupo Constructor Andes tiene lista_precio_id no nulo
