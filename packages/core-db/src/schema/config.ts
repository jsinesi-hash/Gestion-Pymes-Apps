import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { usuario } from './seguridad';

export const parametros_sistema = sqliteTable('parametros_sistema', {
  clave:           text('clave').primaryKey(),
  valor:           text('valor').notNull(),
  tipo:            text('tipo', { enum: ['number', 'string', 'bool'] }).notNull(),
  descripcion:     text('descripcion'),
  actualizado_en:  integer('actualizado_en', { mode: 'timestamp' }),
  actualizado_por: text('actualizado_por').references(() => usuario.id),
});

/**
 * Configuración del negocio (ADR-155 §1, F1 PR7): las claves que tienen que ser iguales en todas
 * las terminales. Sincroniza como `maestro` (last-write-wins). `parametros_sistema` queda para lo
 * propio de cada terminal (correlativos, backups, SMTP, estado del seed). El `id` es la clave misma
 * (excepción documentada a ADR-003): dos terminales que siembran la misma clave generan la misma
 * fila, sin duplicados. Leer y escribir siempre con `leerParametro`/`escribirParametro`.
 */
export const configuracion_negocio = sqliteTable('configuracion_negocio', {
  id:                      text('id').primaryKey(),
  valor:                   text('valor').notNull(),
  tipo:                    text('tipo', { enum: ['number', 'string', 'bool'] }).notNull(),
  descripcion:             text('descripcion'),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
