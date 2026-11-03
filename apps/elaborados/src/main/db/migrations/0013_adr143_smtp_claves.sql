-- ADR-143 — Claves del correo saliente (SMTP) en Elaborados. Aditiva y retrocompatible.
-- El SMTP pasó al núcleo (ADR-142) y `parametrosSetHandler` solo ACTUALIZA filas que ya existen:
-- sin estas claves, guardar la configuración en Configuración → Email / SMTP no persistiría nada y
-- no daría error. Mismos valores y descripciones que la migración 0027 de Retail. La contraseña del
-- servidor NO va acá: se guarda cifrada con safeStorage (ADR-048). `INSERT OR IGNORE`: no pisa nada.
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion) VALUES
	('smtp_host', '', 'string', 'Host del servidor SMTP para envio de emails.'),
	('smtp_port', '587', 'number', 'Puerto SMTP (587 STARTTLS, 465 SSL).'),
	('smtp_secure', 'false', 'bool', 'true = TLS directa (465); false = STARTTLS (587).'),
	('smtp_from', '', 'string', 'Direccion remitente de los emails (From).'),
	('smtp_user', '', 'string', 'Usuario de autenticacion SMTP.');
