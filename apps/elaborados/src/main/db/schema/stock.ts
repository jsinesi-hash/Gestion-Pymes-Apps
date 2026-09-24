import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const articulo = sqliteTable('articulo', {
  id:                      text('id').primaryKey(),
  nombre:                  text('nombre').notNull(),
  tipo:                    text('tipo', { enum: ['insumo', 'elaborado', 'reventa'] }).notNull(),
  unidad:                  text('unidad', { enum: ['kg', 'l', 'u'] }).notNull(),
  bloquea_sin_stock:       integer('bloquea_sin_stock', { mode: 'boolean' }).notNull().default(true),
  stock_minimo:            real('stock_minimo'),
  costo_promedio_centavos: integer('costo_promedio_centavos').notNull().default(0),
  activo:                  integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const existencia_articulo = sqliteTable('existencia_articulo', {
  id:                      text('id').primaryKey(),
  articulo_id:             text('articulo_id').notNull().unique().references(() => articulo.id),
  stock:                   real('stock').notNull().default(0),
  ultima_fecha_movimiento: integer('ultima_fecha_movimiento', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const movimiento_articulo = sqliteTable('movimiento_articulo', {
  id:               text('id').primaryKey(),
  articulo_id:      text('articulo_id').notNull().references(() => articulo.id),
  tipo:             text('tipo', { enum: ['entrada', 'salida', 'ajuste'] }).notNull(),
  motivo:           text('motivo', { enum: [
    'venta', 'anulacion_venta', 'produccion_consumo', 'produccion_alta',
    'produccion_anulacion', 'compra', 'conteo', 'merma', 'inicial',
  ] }).notNull(),
  cantidad:         real('cantidad').notNull(),
  stock_resultante: real('stock_resultante').notNull(),
  costo_unitario_centavos: integer('costo_unitario_centavos'),
  referencia_tipo:  text('referencia_tipo').notNull(),
  referencia_id:    text('referencia_id').notNull(),
  usuario_id:       text('usuario_id').notNull(),
  fecha:            integer('fecha', { mode: 'timestamp' }).notNull(),
  observaciones:    text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
