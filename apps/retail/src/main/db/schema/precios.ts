import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { producto, producto_presentacion } from './catalog';
import { proveedor } from './personas';

export const lista_precio = sqliteTable('lista_precio', {
  id:                text('id').primaryKey(),
  nombre:            text('nombre').notNull().unique(),
  descripcion:       text('descripcion'),
  tipo:              text('tipo', { enum: ['general', 'especial'] }).notNull().default('general'),
  ajuste_porcentual: real('ajuste_porcentual').notNull().default(0),
  // ADR-049 §2 — modo de cálculo de la lista. Default pct_sobre_lista => comportamiento actual.
  modo_calculo:      text('modo_calculo', { enum: ['margen_costo', 'pct_sobre_lista', 'manual'] })
                       .notNull().default('pct_sobre_lista'),
  predeterminada:    integer('predeterminada', { mode: 'boolean' }).notNull().default(false),
  vigencia_desde:    integer('vigencia_desde', { mode: 'timestamp' }),
  vigencia_hasta:    integer('vigencia_hasta', { mode: 'timestamp' }),
  activo:            integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const lista_precio_detalle = sqliteTable('lista_precio_detalle', {
  id:                text('id').primaryKey(),
  lista_precio_id:   text('lista_precio_id').notNull().references(() => lista_precio.id),
  producto_id:       text('producto_id').notNull().references(() => producto.id),
  ajuste_porcentual: real('ajuste_porcentual').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-049 §2: reglas de margen por lista. Una sola regla aplica por producto y lista
// (resolución por especificidad producto→marca→rubro→proveedor→lista, ver shared/regla.ts).
export const regla_precio = sqliteTable('regla_precio', {
  id:              text('id').primaryKey(),
  lista_precio_id: text('lista_precio_id').notNull().references(() => lista_precio.id),
  tipo:            text('tipo', { enum: ['producto', 'marca', 'rubro', 'proveedor', 'lista'] }).notNull(),
  objetivo_id:     text('objetivo_id'), // null para tipo 'lista' (regla base)
  margen_pct:      real('margen_pct').notNull().default(0),   // markup sobre costo neto
  margen_min_pct:  real('margen_min_pct'),
  margen_max_pct:  real('margen_max_pct'),
  redondeo_modo:   text('redondeo_modo', { enum: ['ninguno', 'terminacion_90', 'terminacion_99', 'multiplo'] })
                     .notNull().default('ninguno'),
  redondeo_valor:  integer('redondeo_valor'),
  prioridad:       integer('prioridad').notNull().default(100), // menor gana a igual especificidad
  activo:          integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-049 §4: lote de publicación de precios. Nada publica sin aprobación.
export const price_batch = sqliteTable('price_batch', {
  id:              text('id').primaryKey(),
  lista_precio_id: text('lista_precio_id').notNull().references(() => lista_precio.id),
  // nullable: se completa en orígenes de costo/proveedor; null en manual/margen ("—" en la UI).
  proveedor_id:    text('proveedor_id').references(() => proveedor.id),
  origen:          text('origen', {
    enum: ['PROVIDER_COST_UPDATE', 'MARGIN_UPDATE', 'SUPPLIER_CHANGE', 'PRODUCT_CREATED',
           'PROMOTION_CREATED', 'MANUAL_RECALCULATION', 'ROLLBACK'],
  }).notNull(),
  referencia_tipo: text('referencia_tipo'),
  referencia_id:   text('referencia_id'),
  estado:          text('estado', {
    enum: ['borrador', 'validado', 'pendiente_aprobacion', 'aprobado', 'publicado',
           'validacion_fallida', 'cancelado', 'revertido'],
  }).notNull().default('borrador'),
  batch_revertido_id: text('batch_revertido_id'),
  productos_ok:    integer('productos_ok').notNull().default(0),
  advertencias:    integer('advertencias').notNull().default(0),
  errores:         integer('errores').notNull().default(0),
  excluidas:       integer('excluidas').notNull().default(0),
  // Métrica de impacto: suma de (precio_propuesto − precio_anterior) de las filas publicables.
  impacto_incremento_centavos: integer('impacto_incremento_centavos').notNull().default(0),
  usuario_creacion_id:  text('usuario_creacion_id').notNull(),
  usuario_aprobador_id: text('usuario_aprobador_id'),
  fecha_creacion:       integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  fecha_aprobacion:     integer('fecha_aprobacion', { mode: 'timestamp' }),
  fecha_publicacion:    integer('fecha_publicacion', { mode: 'timestamp' }),
  observaciones:   text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-049 §4: propuesta de precio por fila (el PRICE_CALCULATION del doc). No es la tabla
// publicada: guarda la propuesta hasta que el lote se aprueba y publica.
export const price_batch_detalle = sqliteTable('price_batch_detalle', {
  id:               text('id').primaryKey(),
  price_batch_id:   text('price_batch_id').notNull().references(() => price_batch.id),
  producto_id:      text('producto_id').notNull().references(() => producto.id),
  presentacion_id:  text('presentacion_id').references(() => producto_presentacion.id),
  costo_neto_centavos:       integer('costo_neto_centavos'),
  precio_anterior_centavos:  integer('precio_anterior_centavos'),
  precio_propuesto_centavos: integer('precio_propuesto_centavos').notNull(),
  margen_anterior_pct: real('margen_anterior_pct'),
  margen_nuevo_pct:    real('margen_nuevo_pct'),
  regla_precio_id:  text('regla_precio_id').references(() => regla_precio.id),
  variacion_pct:    real('variacion_pct'),
  estado_validacion: text('estado_validacion', {
    enum: ['ok', 'advertencia', 'error', 'excluida'],
  }).notNull().default('ok'),
  motivo_validacion: text('motivo_validacion'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-034: registro inmutable de cada ejecución de recálculo masivo
export const recalculo_masivo = sqliteTable('recalculo_masivo', {
  id:                    text('id').primaryKey(),
  lista_precio_id:       text('lista_precio_id').notNull().references(() => lista_precio.id),
  porcentaje:            real('porcentaje').notNull(),
  base_calculo:          text('base_calculo', {
    enum: ['costo_proveedor', 'precio_lista', 'lista', 'manual'],
  }).notNull(),
  base_lista_id:         text('base_lista_id'),
  base_valor_centavos:   integer('base_valor_centavos'),
  alcance:               text('alcance', {
    enum: ['catalogo', 'rubro', 'marca', 'proveedor', 'lista'],
  }).notNull(),
  alcance_id:            text('alcance_id'),
  excluir_manuales_dias: integer('excluir_manuales_dias'),
  productos_afectados:   integer('productos_afectados').notNull().default(0),
  // ADR-049 §4: traza al lote que originó este recálculo (nullable por histórico).
  price_batch_id:        text('price_batch_id').references(() => price_batch.id),
  estado:                text('estado', { enum: ['aplicado', 'error'] }).notNull().default('aplicado'),
  usuario_id:            text('usuario_id').notNull(),
  fecha_ejecucion:       integer('fecha_ejecucion', { mode: 'timestamp' }).notNull(),
  observaciones:         text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-034: historial SCD tipo 2 de precios absolutos por (lista, producto)
// El índice único parcial WHERE fecha_hasta IS NULL se define solo en la migración SQL.
export const lista_precio_valor = sqliteTable('lista_precio_valor', {
  id:                  text('id').primaryKey(),
  lista_precio_id:     text('lista_precio_id').notNull().references(() => lista_precio.id),
  producto_id:         text('producto_id').notNull().references(() => producto.id),
  precio_centavos:     integer('precio_centavos').notNull(),
  fecha_desde:         integer('fecha_desde', { mode: 'timestamp' }).notNull(),
  fecha_hasta:         integer('fecha_hasta', { mode: 'timestamp' }),
  origen:              text('origen', { enum: ['manual', 'recalculo', 'importacion'] }).notNull().default('manual'),
  recalculo_masivo_id: text('recalculo_masivo_id').references(() => recalculo_masivo.id),
  // ADR-040: nullable para filas históricas; NOT NULL enforceado en handlers para nuevas filas
  presentacion_id:     text('presentacion_id').references(() => producto_presentacion.id),
  usuario_id:          text('usuario_id').notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-034: precio especial temporal que pisa lista_precio_valor mientras está activa
export const promocion = sqliteTable('promocion', {
  id:                      text('id').primaryKey(),
  lista_precio_id:         text('lista_precio_id').notNull().references(() => lista_precio.id),
  producto_id:             text('producto_id').notNull().references(() => producto.id),
  precio_centavos:         integer('precio_centavos').notNull(),
  fecha_desde:             integer('fecha_desde', { mode: 'timestamp' }).notNull(),
  fecha_hasta:             integer('fecha_hasta', { mode: 'timestamp' }).notNull(),
  descripcion:             text('descripcion'),
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

// ADR-034: recálculo programado para ejecutarse en fecha_aplicacion futura
export const cambio_programado = sqliteTable('cambio_programado', {
  id:                      text('id').primaryKey(),
  lista_precio_id:         text('lista_precio_id').notNull().references(() => lista_precio.id),
  porcentaje:              real('porcentaje').notNull(),
  base_calculo:            text('base_calculo', {
    enum: ['costo_proveedor', 'precio_lista', 'lista', 'manual'],
  }).notNull(),
  base_lista_id:           text('base_lista_id'),
  base_valor_centavos:     integer('base_valor_centavos'),
  alcance:                 text('alcance', {
    enum: ['catalogo', 'rubro', 'marca', 'proveedor', 'lista'],
  }).notNull(),
  alcance_id:              text('alcance_id'),
  excluir_manuales_dias:   integer('excluir_manuales_dias'),
  fecha_aplicacion:        integer('fecha_aplicacion', { mode: 'timestamp' }).notNull(),
  estado:                  text('estado', {
    enum: ['pendiente', 'aplicado', 'cancelado'],
  }).notNull().default('pendiente'),
  recalculo_masivo_id:     text('recalculo_masivo_id').references(() => recalculo_masivo.id),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
