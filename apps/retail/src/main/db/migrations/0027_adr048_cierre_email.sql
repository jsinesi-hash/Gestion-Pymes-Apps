-- ADR-048 (Lote 2): severidad de aviso (normal|alerta), reutilizable por productores.
-- usuario.email YA existe (migracion 0001). La contrasena SMTP NO va aca (safeStorage).
ALTER TABLE `aviso` ADD COLUMN `severidad` TEXT NOT NULL DEFAULT 'normal';
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion) VALUES
	('arqueo_diferencia_alerta_centavos', '200000', 'number', 'Umbral en centavos: si |diferencia| lo supera, el aviso de cierre se marca severidad=alerta ($2.000 default).'),
	('notif_cierre_destinatario', '{"tipo":"rol","rol":"supervisor"}', 'string', 'Destinatario del aviso de cierre de caja (JSON {tipo,rol|id}). Default: rol supervisor.'),
	('smtp_host', '', 'string', 'Host del servidor SMTP para envio de emails.'),
	('smtp_port', '587', 'number', 'Puerto SMTP (587 STARTTLS, 465 SSL).'),
	('smtp_secure', 'false', 'bool', 'true = TLS directa (465); false = STARTTLS (587).'),
	('smtp_from', '', 'string', 'Direccion remitente de los emails (From).'),
	('smtp_user', '', 'string', 'Usuario de autenticacion SMTP.');
