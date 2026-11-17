-- ADR-151 (F1 PR6b) — El costo promedio se proyecta desde el libro. La importación de un producto
-- nuevo con costo y sin stock fijaba precio_costo_promedio sin dejar movimiento. Esta migración solo
-- AGREGA al libro (no modifica ni borra) un movimiento `inicial` de cantidad 0 con ese costo, fechado
-- en el alta del producto, a cada producto con costo y ninguna entrada con costo. Idempotente.
INSERT INTO `movimiento_stock` (`id`, `producto_id`, `tipo`, `motivo`, `cantidad`, `stock_resultante`, `costo_unitario`,
  `referencia_tipo`, `referencia_id`, `ubicacion_id`, `usuario_id`, `fecha`, `observaciones`,
  `version`, `origin_id`, `sync_state`, `updated_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-'
    || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  p.`id`, 'entrada', 'inicial', 0, 0, p.`precio_costo_promedio`,
  'migracion', '0057_adr151_costo_sin_movimiento', NULL, p.`usuario_creacion_id`, p.`fecha_creacion`,
  'Costo del producto sin movimiento que lo registrara (ADR-151)',
  1, p.`origin_id`, 'pending', CAST(strftime('%s', 'now') AS INTEGER)
FROM `producto` p
WHERE p.`precio_costo_promedio` > 0
  AND NOT EXISTS (
    SELECT 1 FROM `movimiento_stock` m
    WHERE m.`producto_id` = p.`id` AND m.`tipo` = 'entrada' AND m.`costo_unitario` > 0
  );
