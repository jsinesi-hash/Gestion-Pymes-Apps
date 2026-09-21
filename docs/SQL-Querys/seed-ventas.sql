-- Equivalente SQL de dev-seed/ventas.ts
-- Solo referencia/auditoría — no ejecutar directamente.
-- Requiere que seed-catalog y seed-personas estén ya aplicados.
-- Nota: IDs reales son UUID generados con randomUUID() en TypeScript.
--       Fechas calculadas a partir del día anterior a la ejecución.

-- ── Caja histórica cerrada (ayer) ─────────────────────────────────────────────
-- apertura: ayer 08:00:00  |  cierre: ayer 18:00:00
-- usuario_id = usuario_cierre_id = id del usuario 'admin'
-- monto_inicial: 5000  |  monto_esperado: 85000  |  monto_contado: 84800
-- diferencia: -200 (cobro menor al esperado)  |  estado: 'cerrada'
INSERT INTO caja (id, usuario_id, fecha_apertura, fecha_cierre, monto_inicial,
  monto_esperado, monto_contado, diferencia, estado, usuario_cierre_id,
  version, origin_id, sync_state, updated_at)
SELECT
  lower(hex(randomblob(16))),
  u.id,
  strftime('%s', date('now','-1 day') || ' 08:00:00') * 1000,
  strftime('%s', date('now','-1 day') || ' 18:00:00') * 1000,
  5000, 85000, 84800, -200, 'cerrada', u.id,
  1, 'system', 'synced',
  strftime('%s', date('now','-1 day') || ' 18:00:00') * 1000
FROM usuario u WHERE u.nombre_usuario = 'admin';

-- ── Ventas (15) ───────────────────────────────────────────────────────────────
-- Todas en la caja anterior, usuario = admin, estado_sync = synced.
-- Fechas distribuidas entre 08:00 y ~16:40 del día anterior
--   (hora = 8 + floor(i*0.6), minuto = (i*36)%60, i=0..14).
-- Cálculo de totales (TypeScript):
--   subtotal = sum(precio_unitario * cantidad)  [redondeado a 2 decimales]
--   descuento_aplicado = subtotal * desc_global / 100  [si desc_global > 0]
--   base_con_desc = subtotal - descuento_aplicado
--   importe_iva = round(base_con_desc * 21 / 121, 2)   [IVA incluido en precio]
--   total = round(base_con_desc)                        [redondeado a $1]
--   ajuste_redondeo = total - base_con_desc
--
-- Precios de lista usados (de catalog.ts):
--   P-001=4235  P-002=1355  P-003=2541  P-004=5421  P-007=3049  P-008=20328
--   P-009=16093 P-021=4743  P-022=3049  P-025=762   P-028=305   P-031=1440
--   P-033=1321  P-035=2033
--
-- ┌──────────────┬──────────────┬──────────────────┬──────────┬────────────┬─────────────────────────────┬────────────┐
-- │ numero       │ cliente_doc  │ forma_pago       │ estado   │ desc_global│ lineas                      │ total est. │
-- ├──────────────┼──────────────┼──────────────────┼──────────┼────────────┼─────────────────────────────┼────────────┤
-- │ V-C1-000001  │ CF           │ efectivo         │ confirm. │  0%        │ P-001 x1                    │ 4235       │
-- │ V-C1-000002  │ CF           │ efectivo         │ confirm. │  0%        │ P-002 x2                    │ 2710       │
-- │ V-C1-000003  │ CF           │ efectivo         │ confirm. │  0%        │ P-003 x1                    │ 2541       │
-- │ V-C1-000004  │ CF           │ efectivo         │ confirm. │  0%        │ P-021 x1                    │ 4743       │
-- │ V-C1-000005  │ CF           │ efectivo         │ confirm. │ 10%        │ P-008 x1  (20328*0.9=18295) │ 18295      │
-- │ V-C1-000006  │ CF           │ efectivo         │ confirm. │  0%        │ P-007x1+P-025x2+P-028x5     │ 5098       │
-- │ V-C1-000007  │ 28456789     │ tarjeta          │ confirm. │  0%        │ P-009 x1                    │ 16093      │
-- │ V-C1-000008  │ 35678123     │ tarjeta          │ confirm. │  0%        │ P-031 x3                    │ 4320       │
-- │ V-C1-000009  │ 41234567     │ tarjeta          │ confirm. │  0%        │ P-022 x2                    │ 6098       │
-- │ V-C1-000010  │ 30123456789  │ cuenta_corriente │ confirm. │  0%        │ P-004 x1                    │ 5421       │
-- │ V-C1-000011  │ 20198765432  │ cuenta_corriente │ confirm. │  0%        │ P-033 x3                    │ 3963       │
-- │ V-C1-000012  │ 20301234561  │ transferencia    │ confirm. │  0%        │ P-035 x2                    │ 4066       │
-- │ V-C1-000013  │ CF           │ efectivo         │ anulada  │  0%        │ P-001 x1                    │ 4235       │
-- │ V-C1-000014  │ CF           │ efectivo         │ anulada  │  0%        │ P-007 x1                    │ 3049       │
-- │ V-C1-000015  │ 30123456789  │ cuenta_corriente │ anulada  │  0%        │ P-008 x1                    │ 20328      │
-- └──────────────┴──────────────┴──────────────────┴──────────┴────────────┴─────────────────────────────┴────────────┘
--
-- V-C1-000006 detalle: P-007(3049) + P-025(762*2=1524) + P-028(305*5=1525) = 6098 → no hay redondeo
-- Nota: los totales exactos dependen del redondeo aplicado en runtime; los valores arriba
--       son aproximaciones; consultar la BD real para valores precisos.

-- Las 15 ventas y sus líneas se insertan en TypeScript con IDs dinámicos.
-- Estructura de cada venta (referencia):
-- INSERT INTO venta (id, numero_interno, fecha, cliente_id, usuario_id, caja_id,
--   subtotal, descuento_global, importe_iva, total, ajuste_redondeo,
--   forma_pago, estado, usuario_creacion_id, fecha_creacion,
--   version, origin_id, sync_state, updated_at)
-- VALUES (...);

-- Estructura de cada línea de detalle (referencia):
-- INSERT INTO venta_detalle (id, venta_id, producto_id, descripcion, cantidad,
--   precio_unitario, descuento_linea, alicuota_iva, subtotal,
--   version, origin_id, sync_state, updated_at)
-- VALUES (..., 0, 21, ...);
-- alicuota_iva siempre 21 (snapshot del impuesto del producto al momento de la venta)

-- ── Movimientos de caja (10) ──────────────────────────────────────────────────
-- Se generan SOLO para ventas confirmadas con forma_pago ∈ {efectivo, tarjeta, transferencia}.
-- Las ventas con cuenta_corriente (V-C1-000010, 000011) y las anuladas NO generan movimiento.
-- tipo='ingreso', motivo='venta', referencia_tipo='venta'
--
-- Ventas que SÍ generan movimiento_caja (10):
--   V-C1-000001 efectivo     → monto = total de V-C1-000001
--   V-C1-000002 efectivo     → monto = total de V-C1-000002
--   V-C1-000003 efectivo     → monto = total de V-C1-000003
--   V-C1-000004 efectivo     → monto = total de V-C1-000004
--   V-C1-000005 efectivo     → monto = total de V-C1-000005
--   V-C1-000006 efectivo     → monto = total de V-C1-000006
--   V-C1-000007 tarjeta      → monto = total de V-C1-000007
--   V-C1-000008 tarjeta      → monto = total de V-C1-000008
--   V-C1-000009 tarjeta      → monto = total de V-C1-000009
--   V-C1-000012 transferencia→ monto = total de V-C1-000012
--
-- Ventas que NO generan movimiento_caja (5):
--   V-C1-000010 (cuenta_corriente, confirmada)
--   V-C1-000011 (cuenta_corriente, confirmada)
--   V-C1-000013 (efectivo, anulada)
--   V-C1-000014 (efectivo, anulada)
--   V-C1-000015 (cuenta_corriente, anulada)

-- Estructura de cada movimiento_caja (referencia):
-- INSERT INTO movimiento_caja (id, caja_id, tipo, motivo, monto, forma_pago,
--   referencia_tipo, referencia_id, usuario_id, fecha,
--   version, origin_id, sync_state, updated_at)
-- VALUES (lower(hex(randomblob(16))), '<cajaId>', 'ingreso', 'venta',
--   <total_venta>, '<forma_pago_venta>', 'venta', '<ventaId>', '<adminId>',
--   <fecha_venta>, 1, 'system', 'synced', <fecha_venta>);

-- ── Actualizar correlativo ────────────────────────────────────────────────────
-- El seed establece el correlativo en 15 para que la próxima venta sea V-C1-000016.
UPDATE parametros_sistema SET valor = '15' WHERE clave = 'venta_correlativo_C1';

-- ── Verificación post-seed ────────────────────────────────────────────────────
SELECT 'cajas'              AS tabla, COUNT(*) AS total FROM caja
UNION ALL SELECT 'ventas',              COUNT(*) FROM venta
UNION ALL SELECT 'venta_detalle',       COUNT(*) FROM venta_detalle
UNION ALL SELECT 'ventas confirmadas',  COUNT(*) FROM venta WHERE estado = 'confirmada'
UNION ALL SELECT 'ventas anuladas',     COUNT(*) FROM venta WHERE estado = 'anulada'
UNION ALL SELECT 'movimientos_caja',    COUNT(*) FROM movimiento_caja;
-- Esperado: cajas=1, ventas=15, venta_detalle=18 (15 simples + 3 extra en V-C1-000006),
--           confirmadas=12, anuladas=3, movimientos_caja=10

-- Correlativo actual
SELECT clave, valor FROM parametros_sistema WHERE clave = 'venta_correlativo_C1';
-- Esperado: valor = '15'

-- Ventas por forma de pago y estado
SELECT forma_pago, estado, COUNT(*) AS qty
FROM venta
GROUP BY forma_pago, estado
ORDER BY forma_pago, estado;
-- Esperado:
--   cuenta_corriente | anulada   | 1
--   cuenta_corriente | confirmada| 2
--   efectivo         | anulada   | 2
--   efectivo         | confirmada| 6
--   tarjeta          | confirmada| 3
--   transferencia    | confirmada| 1

-- Ventas sin movimiento de caja (cuenta corriente + anuladas)
SELECT v.numero_interno, v.forma_pago, v.estado, v.total
FROM venta v
LEFT JOIN movimiento_caja mc ON mc.referencia_id = v.id AND mc.referencia_tipo = 'venta'
WHERE mc.id IS NULL
ORDER BY v.numero_interno;
-- Esperado 5 filas:
--   V-C1-000010 | cuenta_corriente | confirmada
--   V-C1-000011 | cuenta_corriente | confirmada
--   V-C1-000013 | efectivo         | anulada
--   V-C1-000014 | efectivo         | anulada
--   V-C1-000015 | cuenta_corriente | anulada
