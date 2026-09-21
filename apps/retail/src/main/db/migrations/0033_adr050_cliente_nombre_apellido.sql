-- ADR-050 — cliente.razon_social se separa en nombre/apellido (ambos NOT NULL).
-- SQLite no soporta DROP COLUMN con reglas NOT NULL en cascada de forma directa:
-- se recrea la tabla, se migran los datos y se renombra (mismo patrón que
-- 0018_cola_revision_descartado.sql).
--
-- Migración de datos: nombre = razon_social para todas las filas existentes.
-- No hay apellido real que separar de una razón social histórica, así que se
-- completa con el placeholder '(revisar)', visible en toda la UI que use
-- nombreCompletoCliente(), para que quede obvio que requiere corrección manual.
-- Excepción: el cliente fijo "Consumidor Final" (UUID determinístico sembrado
-- en 0003_p1.8_venta.sql) se separa correctamente en nombre/apellido reales,
-- para que nombreCompletoCliente() siga mostrando "Consumidor Final" tal cual.
--
-- `cliente` tiene FKs entrantes reales (venta.cliente_id, presupuesto.cliente_id,
-- cuenta_corriente_cliente.cliente_id): en una base con datos, el DROP TABLE de más
-- abajo viola esas constraints salvo que `foreign_keys` esté apagado a nivel de
-- conexión ANTES de que arranque la transacción de migración — ver
-- `runMigrations()` en `db/client.ts`, que lo desactiva alrededor de `migrate()`.
-- (`PRAGMA defer_foreign_keys` puesto acá, dentro del propio archivo, no alcanza:
-- Drizzle ya abrió la transacción antes de correr esta migración, y en la práctica
-- el chequeo diferido igual falla al hacer COMMIT.)

CREATE TABLE `cliente_new` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo_documento` text NOT NULL,
	`numero_documento` text NOT NULL,
	`nombre` text NOT NULL,
	`apellido` text NOT NULL,
	`nombre_fantasia` text,
	`condicion_fiscal` text NOT NULL,
	`domicilio` text,
	`localidad_id` text REFERENCES `localidad`(`id`),
	`localidad` text,
	`provincia` text,
	`codigo_postal` text,
	`calle` text,
	`numero` text,
	`aclaracion` text,
	`telefono_adicional` text,
	`telefono` text,
	`email` text,
	`habilita_cuenta_corriente` integer DEFAULT false NOT NULL,
	`lista_precio_id` text,
	`activo` integer DEFAULT true NOT NULL,
	`usuario_creacion_id` text NOT NULL,
	`fecha_creacion` integer NOT NULL,
	`usuario_modificacion_id` text,
	`fecha_actualizacion` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_id` text NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lista_precio_id`) REFERENCES `lista_precio`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `cliente_new`
	SELECT `id`, `tipo_documento`, `numero_documento`,
	       CASE WHEN `id` = 'cf000000-0000-0000-0000-000000000001' THEN 'Consumidor' ELSE `razon_social` END,
	       CASE WHEN `id` = 'cf000000-0000-0000-0000-000000000001' THEN 'Final' ELSE '(revisar)' END,
	       `nombre_fantasia`, `condicion_fiscal`, `domicilio`, `localidad_id`, `localidad`,
	       `provincia`, `codigo_postal`, `calle`, `numero`, `aclaracion`, `telefono_adicional`,
	       `telefono`, `email`, `habilita_cuenta_corriente`, `lista_precio_id`, `activo`,
	       `usuario_creacion_id`, `fecha_creacion`, `usuario_modificacion_id`, `fecha_actualizacion`,
	       `version`, `origin_id`, `sync_state`, `updated_at`
	FROM `cliente`;
--> statement-breakpoint
DROP TABLE `cliente`;
--> statement-breakpoint
ALTER TABLE `cliente_new` RENAME TO `cliente`;
