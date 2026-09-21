CREATE TABLE IF NOT EXISTS `restore_log` (
  `id` text PRIMARY KEY NOT NULL,
  `fecha` text NOT NULL,
  `usuario_id` text NOT NULL,
  `archivo_origen` text NOT NULL,
  `manifest_backup` text NOT NULL,
  `row_counts_antes` text NOT NULL,
  `row_counts_despues` text NOT NULL,
  `resultado` text NOT NULL,
  `error_detalle` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_auto_habilitado', 'true',  'bool',   'Habilitar backup automático al cerrar caja');
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_retencion_dias', '30',     'number', 'Días de retención de archivos de backup');
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_destino_local',  '',       'string', 'Carpeta destino de backups (vacío = pedir siempre)');
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_incluir_certs',  'false',  'bool',   'Incluir certificados AFIP en backups (requiere contraseña)');
