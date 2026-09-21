-- 0003_p1.8_venta.sql
-- Cliente "Consumidor Final" fijo con UUID determinístico
INSERT OR IGNORE INTO cliente (
  id, tipo_documento, numero_documento, razon_social,
  condicion_fiscal, habilita_cuenta_corriente, activo,
  usuario_creacion_id, fecha_creacion,
  version, origin_id, sync_state, updated_at
) VALUES (
  'cf000000-0000-0000-0000-000000000001',
  'CUIT', '00000000000', 'Consumidor Final',
  'Consumidor Final', 0, 1,
  'system', CAST(strftime('%s','now') * 1000 AS INTEGER),
  1, 'SYSTEM', 'synced', CAST(strftime('%s','now') * 1000 AS INTEGER)
);
--> statement-breakpoint
-- Contador de numeración interna por terminal (C1 es el valor por defecto)
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('venta_correlativo_C1', '0', 'number', 'Correlativo de ventas para terminal C1');
