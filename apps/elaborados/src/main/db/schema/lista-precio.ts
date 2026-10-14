import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { lista_precio } from '@core/db';
import { producto_venta } from './venta-catalogo';

// E4-PR3 (ADR-104): historial SCD tipo 2 de precios absolutos por (lista, producto de venta).
// Vigente = fecha_hasta IS NULL. El índice único parcial (lista, producto) WHERE fecha_hasta IS NULL
// vive solo en la migración SQL (Drizzle no lo expresa). Dinero en centavos.
export const producto_venta_precio = sqliteTable('producto_venta_precio', {
  id:                text('id').primaryKey(),
  lista_precio_id:   text('lista_precio_id').notNull().references(() => lista_precio.id),
  producto_venta_id: text('producto_venta_id').notNull().references(() => producto_venta.id),
  precio_centavos:   integer('precio_centavos').notNull(),
  fecha_desde:       integer('fecha_desde', { mode: 'timestamp' }).notNull(),
  fecha_hasta:       integer('fecha_hasta', { mode: 'timestamp' }),
  usuario_id:        text('usuario_id').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
