import {
  sqliteTable, text, real, integer, unique,
} from 'drizzle-orm/sqlite-core';

export const unidad = sqliteTable('unidad', {
  id:                      text('id').primaryKey(),
  nombre:                  text('nombre').notNull(),
  abreviatura:             text('abreviatura').notNull().unique(),
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

export const categoria = sqliteTable('categoria', {
  id:                   text('id').primaryKey(),
  categoria_padre_id:   text('categoria_padre_id'),
  nombre:               text('nombre').notNull(),
  descripcion:          text('descripcion'),
  activo:               integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id:  text('usuario_creacion_id').notNull(),
  fecha_creacion:       integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:  integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const marca = sqliteTable('marca', {
  id:          text('id').primaryKey(),
  nombre:      text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
  activo:      integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

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

export const ubicacion = sqliteTable('ubicacion', {
  id:          text('id').primaryKey(),
  codigo:      text('codigo').notNull().unique(),
  sector:      text('sector').notNull(),
  estante:     text('estante').notNull(),
  posicion:    text('posicion').notNull(),
  descripcion: text('descripcion'),
  activo:      integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => [
  unique('ubicacion_sector_estante_posicion').on(t.sector, t.estante, t.posicion),
]);

export const producto = sqliteTable('producto', {
  id:                    text('id').primaryKey(),
  sku:                   text('sku').notNull().unique(),
  sku_secuencial:        integer('sku_secuencial').notNull(),
  gtin_barcode:          text('gtin_barcode'),
  nombre_corto:          text('nombre_corto').notNull(),
  // ADR-067: proyección normalizada de nombre_corto (minúsculas, sin acentos) para el
  // match de búsqueda acento-insensible (sinónimos). Se mantiene en alta/edición/import
  // y se backfillea al migrar. Nullable por las filas previas a la migración 0037.
  nombre_corto_norm:     text('nombre_corto_norm'),
  nombre_largo:          text('nombre_largo').notNull(),
  descripcion_tecnica:   text('descripcion_tecnica'),
  unidad_venta:          text('unidad_venta').notNull(),
  unidad_compra:         text('unidad_compra'),
  factor_conversion:     real('factor_conversion').notNull().default(1),
  permite_fraccion:      integer('permite_fraccion', { mode: 'boolean' }).notNull().default(false),
  precio_costo_promedio: real('precio_costo_promedio').notNull().default(0),
  precio_venta_lista:    real('precio_venta_lista').notNull().default(0),
  margen_ganancia:       real('margen_ganancia'),
  impuesto_id:           text('impuesto_id').references(() => impuesto.id),
  moneda:                text('moneda').notNull().default('ARS'),
  categoria_id:          text('categoria_id').notNull().references(() => categoria.id),
  marca_id:              text('marca_id').references(() => marca.id),
  producto_padre_id:     text('producto_padre_id'),
  garantia_meses:        integer('garantia_meses'),
  ubicacion_id:          text('ubicacion_id').references(() => ubicacion.id),
  activo:                integer('activo', { mode: 'boolean' }).notNull().default(true),
  discontinuado:         integer('discontinuado', { mode: 'boolean' }).notNull().default(false),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const existencias = sqliteTable('existencias', {
  id:                    text('id').primaryKey(),
  producto_id:           text('producto_id').notNull().unique().references(() => producto.id),
  stock_fisico:          real('stock_fisico').notNull().default(0),
  stock_reservado:       real('stock_reservado'),
  stock_en_transito:     real('stock_en_transito'),
  stock_minimo:          real('stock_minimo').notNull().default(0),
  stock_maximo:          real('stock_maximo'),
  ultima_fecha_movimiento: integer('ultima_fecha_movimiento', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const movimiento_stock = sqliteTable('movimiento_stock', {
  id:               text('id').primaryKey(),
  producto_id:      text('producto_id').notNull().references(() => producto.id),
  tipo:             text('tipo', { enum: ['entrada', 'salida', 'ajuste', 'transferencia'] }).notNull(),
  motivo:           text('motivo', { enum: ['venta', 'recepcion_compra', 'devolucion', 'ajuste_conteo', 'merma_rotura', 'inicial', 'entrada_manual'] }).notNull(),
  cantidad:         real('cantidad').notNull(),
  stock_resultante: real('stock_resultante').notNull(),
  costo_unitario:   real('costo_unitario'),
  referencia_tipo:  text('referencia_tipo').notNull(),
  referencia_id:    text('referencia_id').notNull(),
  ubicacion_id:     text('ubicacion_id'),
  usuario_id:       text('usuario_id').notNull(),
  fecha:            integer('fecha', { mode: 'timestamp' }).notNull(),
  observaciones:    text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-040: presentaciones de venta de un producto (una unidad de stock, N presentaciones)
// Índices parciales en migration SQL (no expresables en Drizzle schema para SQLite):
//   UNIQUE (gtin_barcode) WHERE gtin_barcode IS NOT NULL AND activo = 1  (ADR-068)
//   UNIQUE (producto_id)  WHERE es_default = 1
export const producto_presentacion = sqliteTable('producto_presentacion', {
  id:             text('id').primaryKey(),
  producto_id:    text('producto_id').notNull().references(() => producto.id),
  unidad_id:      text('unidad_id').notNull().references(() => unidad.id),
  factor_a_stock: real('factor_a_stock').notNull().default(1.0),
  gtin_barcode:   text('gtin_barcode'),
  es_default:     integer('es_default', { mode: 'boolean' }).notNull().default(false),
  activo:         integer('activo', { mode: 'boolean' }).notNull().default(true),
  sin_confirmar:  integer('sin_confirmar', { mode: 'boolean' }).notNull().default(false),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Sustitutos curados: relaciones producto↔producto (equivalente simétrico | reemplazo direccional).
// Soft-delete por deleted_at (patrón producto_proveedor). Índices en migración SQL (0036):
//   idx por producto_id y por producto_relacionado_id; único parcial (producto_id, producto_relacionado_id, tipo) WHERE deleted_at IS NULL.
export const producto_equivalencia = sqliteTable('producto_equivalencia', {
  id:                      text('id').primaryKey(),
  producto_id:             text('producto_id').notNull().references(() => producto.id),
  producto_relacionado_id: text('producto_relacionado_id').notNull().references(() => producto.id),
  tipo:                    text('tipo', { enum: ['equivalente', 'reemplazo'] }).notNull(),
  nota:                    text('nota'),
  deleted_at:              integer('deleted_at', { mode: 'timestamp' }),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
