-- ADR-033: venta en espera
ALTER TABLE venta ADD COLUMN alias TEXT;
--> statement-breakpoint
ALTER TABLE venta ADD COLUMN en_espera_desde INTEGER;
--> statement-breakpoint
ALTER TABLE venta ADD COLUMN turno_creacion_id TEXT;
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES
  ('pos.ventas_en_espera.max', '10', 'number', 'Máximo de ventas en espera simultáneas'),
  ('pos.ventas_en_espera.ttl_horas', '24', 'number', 'Horas hasta marcar como vencida (solo señaliza, no auto-descarta)');
