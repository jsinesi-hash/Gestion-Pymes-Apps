-- ADR-155 §1 (F1 PR7) — Configuración del negocio vs. de la terminal. Las claves que tienen que ser
-- iguales en todas las terminales pasan, con su valor actual, a `configuracion_negocio` (sincroniza);
-- `parametros_sistema` queda para lo propio de cada terminal. El id es la clave misma.
CREATE TABLE `configuracion_negocio` (
	`id` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`tipo` text NOT NULL,
	`descripcion` text,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `configuracion_negocio` (`id`, `valor`, `tipo`, `descripcion`, `usuario_modificacion_id`, `fecha_actualizacion`, `origin_id`, `updated_at`)
SELECT `clave`, `valor`, `tipo`, `descripcion`, `actualizado_por`, `actualizado_en`, COALESCE((SELECT `origin_id` FROM `usuario` ORDER BY `fecha_creacion` LIMIT 1), 'C1'),
  COALESCE(`actualizado_en`, CAST(strftime('%s', 'now') AS INTEGER))
FROM `parametros_sistema` WHERE `clave` IN ('agenda_catchup_limite', 'agenda_habilitado', 'agenda_ventana_proximos_dias', 'arqueo_diferencia_alerta_centavos', 'bloqueo_inactividad_habilitado', 'bloqueo_inactividad_minutos', 'busqueda_similares_habilitado', 'cc_dias_vencimiento', 'cliente_dias_inactividad', 'dashboard_dias_sin_movimiento', 'hub_precios_habilitado', 'inicio_personalizable_habilitado', 'motor_precios_v2_habilitado', 'notif_bajo_minimo_email', 'notif_cierre_caja_email', 'notif_cierre_destinatario', 'notif_recepcion_email', 'pos.ventas_en_espera.max', 'pos.ventas_en_espera.ttl_horas', 'precios.excluir_manuales_dias_default', 'precios.margen_minimo_pct', 'precios.recalculo.dias_exclusion_manual', 'precios.variacion_maxima_pct', 'presupuesto_validez_dias_default', 'presupuestos_habilitado', 'remito_valorizado', 'remitos_habilitado', 'sinonimos_habilitado', 'sustitutos_habilitado', 'umbral_diferencia_caja', 'vistos_recientes_habilitado');
--> statement-breakpoint
DELETE FROM `parametros_sistema` WHERE `clave` IN ('agenda_catchup_limite', 'agenda_habilitado', 'agenda_ventana_proximos_dias', 'arqueo_diferencia_alerta_centavos', 'bloqueo_inactividad_habilitado', 'bloqueo_inactividad_minutos', 'busqueda_similares_habilitado', 'cc_dias_vencimiento', 'cliente_dias_inactividad', 'dashboard_dias_sin_movimiento', 'hub_precios_habilitado', 'inicio_personalizable_habilitado', 'motor_precios_v2_habilitado', 'notif_bajo_minimo_email', 'notif_cierre_caja_email', 'notif_cierre_destinatario', 'notif_recepcion_email', 'pos.ventas_en_espera.max', 'pos.ventas_en_espera.ttl_horas', 'precios.excluir_manuales_dias_default', 'precios.margen_minimo_pct', 'precios.recalculo.dias_exclusion_manual', 'precios.variacion_maxima_pct', 'presupuesto_validez_dias_default', 'presupuestos_habilitado', 'remito_valorizado', 'remitos_habilitado', 'sinonimos_habilitado', 'sustitutos_habilitado', 'umbral_diferencia_caja', 'vistos_recientes_habilitado');
--> statement-breakpoint
INSERT OR IGNORE INTO `configuracion_negocio` (`id`, `valor`, `tipo`, `descripcion`, `origin_id`, `updated_at`)
VALUES ('caja_modo', 'por_terminal', 'string', 'Cómo trabajan las cajas: por_terminal (cada terminal su turno) o compartida (un turno para todo el negocio, solo con varias terminales)', COALESCE((SELECT `origin_id` FROM `usuario` ORDER BY `fecha_creacion` LIMIT 1), 'C1'), CAST(strftime('%s', 'now') AS INTEGER));
--> statement-breakpoint
-- Instalaciones donde la 0020 no sembró estas dos claves (desfasaje de orden, ver db/reconcile.ts):
-- se agregan con su default para que existan y viajen como el resto. No pisa un valor existente.
INSERT OR IGNORE INTO `configuracion_negocio` (`id`, `valor`, `tipo`, `descripcion`, `origin_id`, `updated_at`)
VALUES ('cc_dias_vencimiento', '30', 'number', 'Días desde fecha_ultimo_movimiento en CCC para considerar deuda vencida', COALESCE((SELECT `origin_id` FROM `usuario` ORDER BY `fecha_creacion` LIMIT 1), 'C1'), CAST(strftime('%s', 'now') AS INTEGER)),
       ('cliente_dias_inactividad', '60', 'number', 'Días sin ventas confirmadas para clasificar cliente como inactivo en dashboard', COALESCE((SELECT `origin_id` FROM `usuario` ORDER BY `fecha_creacion` LIMIT 1), 'C1'), CAST(strftime('%s', 'now') AS INTEGER));
