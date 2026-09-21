-- ADR-067 — Sinónimos de búsqueda para el catálogo de ferretería.
-- Migración ADITIVA: CREATE TABLE + índices + flag en parametros_sistema (default false).
-- No toca ninguna tabla existente. La feature (expansión de búsqueda + ABM + import) vive
-- detrás del flag `sinonimos_habilitado` (ADR-042/044). Los datos base los siembra
-- runSinonimoSeed en el first-run.
CREATE TABLE `sinonimo` (
    `id`                      TEXT PRIMARY KEY NOT NULL,
    `grupo_id`                TEXT NOT NULL,
    `termino`                 TEXT NOT NULL,
    `termino_norm`            TEXT NOT NULL,
    `es_canonico`             INTEGER NOT NULL DEFAULT 0,
    `es_abreviatura`          INTEGER NOT NULL DEFAULT 0,
    `rubro`                   TEXT,
    `nota`                    TEXT,
    `origen`                  TEXT NOT NULL DEFAULT 'manual',
    `activo`                  INTEGER NOT NULL DEFAULT 1,
    `usuario_creacion_id`     TEXT NOT NULL,
    `fecha_creacion`          INTEGER NOT NULL,
    `usuario_modificacion_id` TEXT,
    `fecha_actualizacion`     INTEGER,
    `version`                 INTEGER NOT NULL DEFAULT 1,
    `origin_id`               TEXT NOT NULL,
    `sync_state`              TEXT NOT NULL DEFAULT 'pending',
    `updated_at`              INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sinonimo_termino_norm` ON `sinonimo` (`termino_norm`);
--> statement-breakpoint
CREATE INDEX `idx_sinonimo_grupo` ON `sinonimo` (`grupo_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sinonimo_grupo_termino` ON `sinonimo` (`grupo_id`, `termino_norm`);
--> statement-breakpoint
INSERT INTO `parametros_sistema` (`clave`, `valor`, `tipo`, `descripcion`)
VALUES ('sinonimos_habilitado', 'false', 'bool', 'ADR-067: expansión de búsqueda de productos por sinónimos');
