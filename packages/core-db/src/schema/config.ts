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
