-- Parámetros para Dashboard Fase 2 (ADR-038)
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('cc_dias_vencimiento', '30', 'number', 'Días desde fecha_ultimo_movimiento en CCC para considerar deuda vencida');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('cliente_dias_inactividad', '60', 'number', 'Días sin ventas confirmadas para clasificar cliente como inactivo en dashboard');
