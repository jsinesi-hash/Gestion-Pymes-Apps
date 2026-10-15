import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
import { venta } from '@core/db';
import { articulo } from './stock';
import { producto_venta, grupo_modificador_opcion } from './venta-catalogo';

export const venta_linea = sqliteTable('venta_linea', {
  id:                       text('id').primaryKey(),
  venta_id:                 text('venta_id').notNull().references(() => venta.id),
  producto_venta_id:        text('producto_venta_id').notNull().references(() => producto_venta.id),
  descripcion:              text('descripcion').notNull(),
  cantidad:                 real('cantidad').notNull(),
  precio_unitario_centavos: integer('precio_unitario_centavos').notNull(),
  descuento_linea_pct:      real('descuento_linea_pct').notNull().default(0),
  alicuota_iva:             real('alicuota_iva').notNull(),
  subtotal_centavos:        integer('subtotal_centavos').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => [index('idx_venta_linea_venta_id').on(t.venta_id)]);

export const venta_linea_modificador = sqliteTable('venta_linea_modificador', {
  id:                          text('id').primaryKey(),
  venta_linea_id:              text('venta_linea_id').notNull().references(() => venta_linea.id),
  grupo_modificador_opcion_id: text('grupo_modificador_opcion_id').notNull().references(() => grupo_modificador_opcion.id),
  articulo_id:                 text('articulo_id').notNull().references(() => articulo.id),
  descripcion:                 text('descripcion').notNull(),
  recargo_centavos:            integer('recargo_centavos').notNull().default(0),
  cantidad_consumida:          real('cantidad_consumida').notNull().default(0),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => [index('idx_venta_linea_modificador_linea_id').on(t.venta_linea_id)]);
