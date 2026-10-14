import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { proveedor } from '@core/db';
import { articulo } from './stock';

// E4-PR2 (ADR-103): compras de insumos. Dinero en centavos; sin IVA discriminado (el costo del
// artículo es lo que se paga). `proveedor_id` es opcional: se puede comprar sin proveedor cargado.
export const compra = sqliteTable('compra', {
  id:                 text('id').primaryKey(),
  numero:             text('numero').notNull().unique(),
  proveedor_id:       text('proveedor_id').references(() => proveedor.id),
  comprobante:        text('comprobante'),
  total_centavos:     integer('total_centavos').notNull(),
  estado:             text('estado', { enum: ['confirmada', 'anulada'] }).notNull().default('confirmada'),
  fecha:              integer('fecha', { mode: 'timestamp' }).notNull(),
  usuario_id:         text('usuario_id').notNull(),
  observaciones:      text('observaciones'),
  motivo_anulacion:   text('motivo_anulacion'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const compra_item = sqliteTable('compra_item', {
  id:                      text('id').primaryKey(),
  compra_id:               text('compra_id').notNull().references(() => compra.id),
  articulo_id:             text('articulo_id').notNull().references(() => articulo.id),
  descripcion:             text('descripcion').notNull(), // snapshot del nombre
  cantidad:                real('cantidad').notNull(),
  costo_unitario_centavos: integer('costo_unitario_centavos').notNull(),
  subtotal_centavos:       integer('subtotal_centavos').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
