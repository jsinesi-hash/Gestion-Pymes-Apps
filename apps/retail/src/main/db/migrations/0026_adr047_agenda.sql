-- ADR-047 (Lote 1): Agenda operativa y outbox de avisos. Modulo NUEVO.
-- Tres capas: 1 rutina -> N agenda_evento -> N aviso.
-- rutina y agenda_evento sincronizan (campos de sync, para R4). aviso NO sincroniza:
-- es estado operativo local por terminal (ADR-047 §10).
-- Migracion escrita a mano siguiendo la convencion del repo (las migraciones son SQL
-- crudo; los snapshots de drizzle-kit son esparsos y no son la fuente de verdad).

CREATE TABLE `rutina` (
	`id`                       TEXT NOT NULL PRIMARY KEY,
	`nombre`                   TEXT NOT NULL,
	`descripcion`              TEXT,
	`frecuencia_tipo`          TEXT NOT NULL,   -- unica|diaria|semanal|mensual|cada_n_dias
	`intervalo`                INTEGER NOT NULL DEFAULT 1,
	`dia_semana`               INTEGER,          -- 0=domingo..6=sabado (semanal)
	`dia_mes`                  INTEGER,          -- 1..31 (mensual; 31 -> clamp ultimo dia)
	`hora`                     TEXT,             -- "HH:MM" 24h
	`fecha_inicio`             INTEGER NOT NULL,
	`fecha_fin`                INTEGER,
	`proximo_disparo`          INTEGER,
	`destinatario_tipo`        TEXT NOT NULL,    -- usuario|rol
	`destinatario_usuario_id`  TEXT REFERENCES `usuario`(`id`),
	`destinatario_rol`         TEXT,
	`canal_in_app`             INTEGER NOT NULL DEFAULT 1,
	`canal_email`              INTEGER NOT NULL DEFAULT 0,
	`activa`                   INTEGER NOT NULL DEFAULT 1,   -- pausa (distinta de baja logica)
	`origen_sistema`           INTEGER NOT NULL DEFAULT 0,
	`activo`                   INTEGER NOT NULL DEFAULT 1,   -- baja logica
	`usuario_creacion_id`      TEXT NOT NULL,
	`fecha_creacion`           INTEGER NOT NULL,
	`usuario_modificacion_id`  TEXT,
	`fecha_actualizacion`      INTEGER,
	`version`                  INTEGER NOT NULL DEFAULT 1,
	`origin_id`                TEXT NOT NULL,
	`sync_state`               TEXT NOT NULL DEFAULT 'pending',
	`updated_at`               INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rutina_proximo_idx` ON `rutina` (`activa`,`proximo_disparo`);
--> statement-breakpoint
CREATE TABLE `agenda_evento` (
	`id`                       TEXT NOT NULL PRIMARY KEY,
	`origen`                   TEXT NOT NULL,    -- rutina|manual|orden_compra|recepcion|bajo_minimo|cierre_caja
	`rutina_id`                TEXT REFERENCES `rutina`(`id`),
	`titulo`                   TEXT NOT NULL,
	`descripcion`              TEXT,
	`fecha`                    INTEGER NOT NULL,
	`estado`                   TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente|completada|pospuesta|descartada
	`completado_at`            INTEGER,
	`completado_por`           TEXT REFERENCES `usuario`(`id`),
	`pospuesto_para`           INTEGER,
	`nota`                     TEXT,
	`destinatario_tipo`        TEXT NOT NULL,
	`destinatario_usuario_id`  TEXT REFERENCES `usuario`(`id`),
	`destinatario_rol`         TEXT,
	`canal_in_app`             INTEGER NOT NULL DEFAULT 1,
	`canal_email`              INTEGER NOT NULL DEFAULT 0,
	`proveedor_id`             TEXT REFERENCES `proveedor`(`id`),
	`orden_compra_id`          TEXT REFERENCES `orden_compra`(`id`),
	`producto_id`              TEXT REFERENCES `producto`(`id`),
	`activo`                   INTEGER NOT NULL DEFAULT 1,
	`usuario_creacion_id`      TEXT NOT NULL,
	`fecha_creacion`           INTEGER NOT NULL,
	`usuario_modificacion_id`  TEXT,
	`fecha_actualizacion`      INTEGER,
	`version`                  INTEGER NOT NULL DEFAULT 1,
	`origin_id`                TEXT NOT NULL,
	`sync_state`               TEXT NOT NULL DEFAULT 'pending',
	`updated_at`               INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agenda_evento_estado_fecha_idx` ON `agenda_evento` (`estado`,`fecha`);
--> statement-breakpoint
CREATE TABLE `aviso` (
	`id`                       TEXT NOT NULL PRIMARY KEY,
	`agenda_evento_id`         TEXT REFERENCES `agenda_evento`(`id`),
	`origen_tipo`              TEXT NOT NULL,
	`origen_id`                TEXT,             -- referencia blanda, SIN FK
	`canal`                    TEXT NOT NULL,    -- in_app|email|whatsapp
	`destinatario_usuario_id`  TEXT NOT NULL REFERENCES `usuario`(`id`),
	`destinatario_contacto`    TEXT,             -- email congelado al emitir
	`payload`                  TEXT NOT NULL,    -- JSON snapshot { titulo, cuerpo, datos }
	`estado`                   TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente|enviado|fallido|descartado
	`intentos`                 INTEGER NOT NULL DEFAULT 0,
	`ultimo_error`             TEXT,
	`proximo_intento_at`       INTEGER,
	`dedupe_clave`             TEXT,             -- idempotencia (unique; NULLs no colisionan)
	`generado_at`              INTEGER NOT NULL,
	`enviado_at`               INTEGER
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aviso_dedupe_idx` ON `aviso` (`dedupe_clave`);
--> statement-breakpoint
CREATE INDEX `aviso_estado_idx` ON `aviso` (`estado`,`proximo_intento_at`);
--> statement-breakpoint
-- Parametros del modulo (ADR-047 §6 + flag agenda_habilitado por ADR-044). Editables por Supervisor.
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion) VALUES
	('agenda_habilitado', 'false', 'bool', 'Feature flag del modulo Agenda (ADR-044/047). Default false.'),
	('agenda_ventana_proximos_dias', '14', 'number', 'Horizonte en dias de la zona Proximos en la vista de eventos.'),
	('agenda_catchup_limite', '90', 'number', 'Maximo de dias hacia atras que el catch-up materializa al abrir la app.'),
	('aviso_reintentos_max', '5', 'number', 'Tope de intentos antes de descartar un aviso fallido.'),
	('aviso_backoff_base_seg', '30', 'number', 'Base del backoff exponencial entre reintentos (segundos).'),
	('aviso_retencion_dias', '90', 'number', 'Purga de avisos enviados/descartados mas viejos que N dias (los fallidos no se purgan por antiguedad).'),
	('notif_cierre_caja_email', 'false', 'bool', 'Habilita canal email para notificacion de cierre de caja.'),
	('notif_recepcion_email', 'false', 'bool', 'Habilita canal email para notificacion de recepcion de mercaderia.'),
	('notif_bajo_minimo_email', 'false', 'bool', 'Habilita canal email para el digest de stock bajo minimo.');
