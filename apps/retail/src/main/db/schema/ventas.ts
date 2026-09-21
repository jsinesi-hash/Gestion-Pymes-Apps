import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { producto, producto_presentacion } from './catalog';
import { venta } from '@core/db';

export const venta_detalle = sqliteTable('venta_detalle', {
  id:              text('id').primaryKey(),
  venta_id:        text('venta_id').notNull().references(() => venta.id),
  producto_id:     text('producto_id').notNull().references(() => producto.id),
  descripcion:     text('descripcion').notNull(),
  cantidad:        real('cantidad').notNull(),
  precio_unitario: real('precio_unitario').notNull(),
  descuento_linea: real('descuento_linea').notNull().default(0),
  alicuota_iva:            real('alicuota_iva').notNull(),
  subtotal:                real('subtotal').notNull(),
  // ADR-040: nullable para ventas históricas anteriores a multi-presentación
  presentacion_id:         text('presentacion_id').references(() => producto_presentacion.id),
  factor_a_stock_aplicado: real('factor_a_stock_aplicado'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
