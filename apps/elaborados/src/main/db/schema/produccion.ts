import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { articulo } from './stock';

export const receta_produccion = sqliteTable('receta_produccion', {
  id:             text('id').primaryKey(),
  articulo_id:    text('articulo_id').notNull().unique().references(() => articulo.id),
  rinde_cantidad: real('rinde_cantidad').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const receta_produccion_item = sqliteTable('receta_produccion_item', {
  id:                   text('id').primaryKey(),
  receta_produccion_id: text('receta_produccion_id').notNull().references(() => receta_produccion.id),
  articulo_id:          text('articulo_id').notNull().references(() => articulo.id),
  cantidad:             real('cantidad').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const produccion = sqliteTable('produccion', {
  id:                   text('id').primaryKey(),
  numero:               text('numero').notNull().unique(),
  articulo_id:          text('articulo_id').notNull().references(() => articulo.id),
  cantidad_producida:   real('cantidad_producida').notNull(),
  costo_total_centavos: integer('costo_total_centavos').notNull(),
  estado:               text('estado', { enum: ['confirmada', 'anulada'] }).notNull().default('confirmada'),
  fecha:                integer('fecha', { mode: 'timestamp' }).notNull(),
  usuario_id:           text('usuario_id').notNull(),
  observaciones:        text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
