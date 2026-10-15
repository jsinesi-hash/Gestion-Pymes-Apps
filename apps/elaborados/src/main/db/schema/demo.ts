import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** E5-PR1 (ADR-110): ids creados por el catálogo demo, para poder vaciarlo sin tocar lo cargado a mano. */
export const demo_registro = sqliteTable('demo_registro', {
  id:          text('id').primaryKey(),
  tabla:       text('tabla').notNull(),
  registro_id: text('registro_id').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
