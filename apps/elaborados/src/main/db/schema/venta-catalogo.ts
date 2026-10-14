import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { impuesto } from '@core/db';
import { articulo } from './stock';

export const categoria_venta = sqliteTable('categoria_venta', {
  id:     text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  orden:  integer('orden').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const producto_venta = sqliteTable('producto_venta', {
  id:                 text('id').primaryKey(),
  nombre:             text('nombre').notNull(),
  categoria_venta_id: text('categoria_venta_id').notNull().references(() => categoria_venta.id),
  precio_centavos:    integer('precio_centavos').notNull(),
  impuesto_id:        text('impuesto_id').notNull().references(() => impuesto.id),
  activo:             integer('activo', { mode: 'boolean' }).notNull().default(true),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const producto_venta_componente = sqliteTable('producto_venta_componente', {
  id:                text('id').primaryKey(),
  producto_venta_id: text('producto_venta_id').notNull().references(() => producto_venta.id),
  articulo_id:       text('articulo_id').notNull().references(() => articulo.id),
  cantidad:          real('cantidad').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const grupo_modificador = sqliteTable('grupo_modificador', {
  id:     text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const grupo_modificador_opcion = sqliteTable('grupo_modificador_opcion', {
  id:                   text('id').primaryKey(),
  grupo_modificador_id: text('grupo_modificador_id').notNull().references(() => grupo_modificador.id),
  articulo_id:          text('articulo_id').notNull().references(() => articulo.id),
  nombre:               text('nombre').notNull(),
  recargo_centavos:     integer('recargo_centavos').notNull().default(0),
  cantidad:             real('cantidad').notNull().default(0),
  orden:                integer('orden').notNull().default(0),
  activo:               integer('activo', { mode: 'boolean' }).notNull().default(true),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const producto_venta_grupo = sqliteTable('producto_venta_grupo', {
  id:                   text('id').primaryKey(),
  producto_venta_id:    text('producto_venta_id').notNull().references(() => producto_venta.id),
  grupo_modificador_id: text('grupo_modificador_id').notNull().references(() => grupo_modificador.id),
  min:                  integer('min').notNull().default(0),
  max:                  integer('max').notNull().default(1),
  cantidad_total:       real('cantidad_total').notNull().default(0),
  modo_descuento:       text('modo_descuento', { enum: ['reparto', 'por_opcion', 'sin_descuento'] }).notNull(),
  orden:                integer('orden').notNull().default(0),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
