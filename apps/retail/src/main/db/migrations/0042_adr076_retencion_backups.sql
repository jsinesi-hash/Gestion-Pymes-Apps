INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_retencion_cantidad', '10', 'number', 'Cantidad de backups auto recientes protegidos por carpeta (ADR-076)');
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_retencion_piso', '3', 'number', 'Mínimo absoluto de backups auto conservados por carpeta (ADR-076)');
--> statement-breakpoint
INSERT OR IGNORE INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
  VALUES ('backup_retencion_size_mb', '0', 'number', 'Tope de tamaño por carpeta en MB; 0 = desactivado (ADR-076)');
