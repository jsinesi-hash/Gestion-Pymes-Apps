import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const impuesto = sqliteTable('impuesto', {
  id:           text('id').primaryKey(),
  nombre:       text('nombre').notNull(),
  tipo:         text('tipo', { enum: ['iva', 'exento', 'no_gravado'] }).notNull(),
  alicuota:     real('alicuota').notNull(),
  codigo_arca:  text('codigo_arca'),
  predeterminado: integer('predeterminado', { mode: 'boolean' }).notNull().default(false),
  activo:       integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
