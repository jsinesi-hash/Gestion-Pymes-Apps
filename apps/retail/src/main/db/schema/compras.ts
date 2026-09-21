import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { producto } from './catalog';
import { proveedor, usuario } from '@core/db';

export const producto_proveedor = sqliteTable('producto_proveedor', {
  id:               text('id').primaryKey(),
  producto_id:      text('producto_id').notNull().references(() => producto.id),
  proveedor_id:     text('proveedor_id').notNull().references(() => proveedor.id),
  costo_centavos:   integer('costo_centavos').notNull().default(0),
  codigo_proveedor: text('codigo_proveedor'),
  preferido:        integer('preferido', { mode: 'boolean' }).notNull().default(false),
  // ADR-049 §1 — overrides comerciales por producto (NULL = hereda del proveedor).
  // flete_centavos es el override ABSOLUTO (peso/volumen) que pisa a flete_pct.
  bonificacion_pct:      real('bonificacion_pct'),
  costo_financiero_pct:  real('costo_financiero_pct'),
  flete_pct:             real('flete_pct'),
  flete_centavos:        integer('flete_centavos'),
  otros_costos_centavos: integer('otros_costos_centavos'),
  deleted_at:       integer('deleted_at', { mode: 'timestamp' }),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion:   integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
// Unique constraints enforced via migration:
//   (producto_id, proveedor_id) — evita duplicar el mismo proveedor para un producto
//   WHERE preferido = 1 AND deleted_at IS NULL ON (producto_id) — un único proveedor preferido activo por producto

export const orden_compra = sqliteTable('orden_compra', {
  id:                      text('id').primaryKey(),
  numero_interno:          text('numero_interno').notNull().unique(),
  proveedor_id:            text('proveedor_id').notNull().references(() => proveedor.id),
  tipo:                    text('tipo', { enum: ['manual', 'sugerida'] }).notNull(),
  estado:                  text('estado', {
    enum: ['borrador', 'emitida', 'recibida_parcial', 'recibida_total', 'cerrada', 'anulada'],
  }).notNull().default('borrador'),
  fecha:                   integer('fecha', { mode: 'timestamp' }).notNull(),
  fecha_entrega_estimada:  integer('fecha_entrega_estimada', { mode: 'timestamp' }),
  subtotal_centavos:       integer('subtotal_centavos').notNull().default(0),
  importe_iva_centavos:    integer('importe_iva_centavos').notNull().default(0),
  total_centavos:          integer('total_centavos').notNull().default(0),
  usuario_id:              text('usuario_id').notNull().references(() => usuario.id),
  observaciones:           text('observaciones'),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const item_oc = sqliteTable('item_oc', {
  id:                      text('id').primaryKey(),
  orden_compra_id:         text('orden_compra_id').notNull().references(() => orden_compra.id),
  producto_id:             text('producto_id').notNull().references(() => producto.id),
  descripcion:             text('descripcion').notNull(),        // snapshot nombre
  cantidad_pedida:         real('cantidad_pedida').notNull(),
  cantidad_recibida:       real('cantidad_recibida').notNull().default(0),  // acumulado
  costo_unitario_centavos: integer('costo_unitario_centavos').notNull(),    // congelado al emitir
  alicuota_iva:            real('alicuota_iva').notNull(),                  // snapshot
  subtotal_centavos:       integer('subtotal_centavos').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const recepcion = sqliteTable('recepcion', {
  id:               text('id').primaryKey(),
  orden_compra_id:  text('orden_compra_id').notNull().references(() => orden_compra.id),
  fecha:            integer('fecha', { mode: 'timestamp' }).notNull(),
  usuario_id:       text('usuario_id').notNull().references(() => usuario.id),
  remito_proveedor: text('remito_proveedor'),
  observaciones:    text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const recepcion_detalle = sqliteTable('recepcion_detalle', {
  id:                           text('id').primaryKey(),
  recepcion_id:                 text('recepcion_id').notNull().references(() => recepcion.id),
  item_oc_id:                   text('item_oc_id').notNull().references(() => item_oc.id),
  cantidad_recibida:            real('cantidad_recibida').notNull(),
  // Nulo si el operador no modifica el costo; explicitado y confirmado en P3.5
  costo_unitario_real_centavos: integer('costo_unitario_real_centavos'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const comprobante_compra = sqliteTable('comprobante_compra', {
  id:                     text('id').primaryKey(),
  // Sin FK a recepcion para evitar circularidad; puede registrarse sin recepción previa
  recepcion_id:           text('recepcion_id'),
  proveedor_id:           text('proveedor_id').notNull().references(() => proveedor.id),
  tipo:                   text('tipo', {
    enum: ['factura_a', 'factura_b', 'factura_c', 'nota_credito', 'nota_debito'],
  }).notNull(),
  punto_venta:            integer('punto_venta'),
  numero:                 text('numero'),
  fecha_emision:          integer('fecha_emision', { mode: 'timestamp' }).notNull(),
  importe_neto_centavos:  integer('importe_neto_centavos').notNull().default(0),
  importe_iva_centavos:   integer('importe_iva_centavos').notNull().default(0),
  importe_total_centavos: integer('importe_total_centavos').notNull().default(0),
  estado:                 text('estado', { enum: ['pendiente', 'registrado', 'anulado'] }).notNull().default('pendiente'),
  observaciones:          text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-034: trazabilidad de importaciones de listas de costos por archivo (vive en compras
// para evitar dependencia circular precios.ts ↔ personas.ts)
export const importacion_costo_proveedor = sqliteTable('importacion_costo_proveedor', {
  id:                text('id').primaryKey(),
  proveedor_id:      text('proveedor_id').notNull().references(() => proveedor.id),
  nombre_archivo:    text('nombre_archivo').notNull(),
  fecha_importacion: integer('fecha_importacion', { mode: 'timestamp' }).notNull(),
  filas_totales:     integer('filas_totales').notNull().default(0),
  filas_matcheadas:  integer('filas_matcheadas').notNull().default(0),
  filas_sin_match:   integer('filas_sin_match').notNull().default(0),
  estado:            text('estado', { enum: ['pendiente', 'confirmado', 'cancelado'] }).notNull().default('pendiente'),
  usuario_id:        text('usuario_id').notNull(),
  observaciones:     text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-035: configuración de mapeo de columnas por proveedor (1:1)
export const proveedor_importacion_config = sqliteTable('proveedor_importacion_config', {
  id:                       text('id').primaryKey(),
  proveedor_id:             text('proveedor_id').notNull().references(() => proveedor.id),
  formato_archivo:          text('formato_archivo', { enum: ['csv', 'xlsx'] }).notNull().default('csv'),
  delimitador:              text('delimitador'),
  fila_encabezado:          integer('fila_encabezado').notNull().default(1),
  columna_costo:            text('columna_costo').notNull(),
  columna_codigo_proveedor: text('columna_codigo_proveedor').notNull(),
  columna_gtin:             text('columna_gtin'),
  columna_codigo_interno:   text('columna_codigo_interno'),
  usuario_creacion_id:      text('usuario_creacion_id').notNull(),
  fecha_creacion:           integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-035: trazabilidad de cambios de costo por importación
// (movida desde precios.ts para evitar dependencia circular)
export const importacion_costo_proveedor_detalle = sqliteTable('importacion_costo_proveedor_detalle', {
  id:                      text('id').primaryKey(),
  importacion_id:          text('importacion_id').notNull().references(() => importacion_costo_proveedor.id),
  producto_id:             text('producto_id').references(() => producto.id), // nullable: filas sin_matchear
  costo_anterior_centavos: integer('costo_anterior_centavos'),
  costo_nuevo_centavos:    integer('costo_nuevo_centavos'),
  fila_original:           text('fila_original'),
  // ADR-051 A.4: error_formato = costo no parseable (independiente del match de producto,
  // por eso no entra en la disyunción CHECK de sin_matchear/descartado — ver migración 0031).
  estado:                  text('estado', { enum: ['matched', 'sin_matchear', 'resuelto_manual', 'descartado', 'error_formato'] })
                             .notNull().default('matched'),
  matched_by:              text('matched_by', { enum: ['codigo_proveedor', 'gtin', 'codigo_interno', 'manual', 'similitud'] }),
  resuelto_por_usuario_id: text('resuelto_por_usuario_id'),
  fecha_resolucion:        integer('fecha_resolucion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-054: trazabilidad de importaciones de CATÁLOGO de proveedor (relación
// producto↔proveedor). Espejo de importacion_costo_proveedor pero para el flujo de
// catálogo: persiste qué se creó/actualizó al confirmar. Dinero en centavos.
export const importacion_catalogo_proveedor = sqliteTable('importacion_catalogo_proveedor', {
  id:                   text('id').primaryKey(),
  proveedor_id:         text('proveedor_id').notNull().references(() => proveedor.id),
  nombre_archivo:       text('nombre_archivo').notNull(),
  fecha_importacion:    integer('fecha_importacion', { mode: 'timestamp' }).notNull(),
  filas_totales:        integer('filas_totales').notNull().default(0),
  filas_creadas:        integer('filas_creadas').notNull().default(0),
  filas_actualizadas:   integer('filas_actualizadas').notNull().default(0),
  filas_sin_match:      integer('filas_sin_match').notNull().default(0),
  filas_error:          integer('filas_error').notNull().default(0),
  preferidos_asignados: integer('preferidos_asignados').notNull().default(0),
  estado:               text('estado', { enum: ['confirmado'] }).notNull().default('confirmado'),
  usuario_id:           text('usuario_id').notNull(),
  observaciones:        text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const importacion_catalogo_proveedor_detalle = sqliteTable('importacion_catalogo_proveedor_detalle', {
  id:                      text('id').primaryKey(),
  importacion_id:          text('importacion_id').notNull().references(() => importacion_catalogo_proveedor.id),
  producto_id:             text('producto_id').references(() => producto.id), // nullable: filas sin_matchear/error
  costo_centavos:          integer('costo_centavos'),
  costo_anterior_centavos: integer('costo_anterior_centavos'),
  codigo_producto_prov:    text('codigo_producto_prov'),
  fila_original:           text('fila_original'),
  estado:                  text('estado', { enum: ['crear', 'actualizar', 'sin_matchear', 'error'] }).notNull(),
  matched_by:              text('matched_by', { enum: ['gtin', 'codigo_interno', 'similitud'] }),
  preferido_asignado:      integer('preferido_asignado', { mode: 'boolean' }).notNull().default(false),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
