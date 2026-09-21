import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { producto, producto_presentacion } from './catalog';
import { cliente, usuario } from '@core/db';

export const comprobante = sqliteTable('comprobante', {
  id:                        text('id').primaryKey(),
  // venta_id es TEXT sin FK para romper la circularidad Venta↔Comprobante
  venta_id:                  text('venta_id'),
  tipo:                      text('tipo', { enum: ['ticket_interno', 'factura_a', 'factura_b', 'factura_c', 'nota_credito', 'nota_debito'] }).notNull(),
  punto_venta:               integer('punto_venta'),
  numero:                    text('numero'),
  fecha_emision:             integer('fecha_emision', { mode: 'timestamp' }).notNull(),
  cae:                       text('cae'),
  cae_vencimiento:           integer('cae_vencimiento', { mode: 'timestamp' }),
  condicion_fiscal_emisor:   text('condicion_fiscal_emisor'),
  condicion_fiscal_receptor: text('condicion_fiscal_receptor'),
  importe_neto:              real('importe_neto').notNull().default(0),
  importe_iva:               real('importe_iva').notNull().default(0),
  importe_total:             real('importe_total').notNull().default(0),
  estado:                    text('estado', { enum: ['pendiente_cae', 'autorizado', 'rechazado', 'anulado'] }).notNull().default('pendiente_cae'),
  comprobante_referencia_id: text('comprobante_referencia_id'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const caja = sqliteTable('caja', {
  id:               text('id').primaryKey(),
  usuario_id:       text('usuario_id').notNull().references(() => usuario.id),
  fecha_apertura:   integer('fecha_apertura', { mode: 'timestamp' }).notNull(),
  fecha_cierre:     integer('fecha_cierre', { mode: 'timestamp' }),
  monto_inicial:    real('monto_inicial').notNull().default(0),
  monto_esperado:   real('monto_esperado'),
  monto_contado:    real('monto_contado'),
  diferencia:       real('diferencia'),
  estado:           text('estado', { enum: ['abierta', 'cerrada'] }).notNull().default('abierta'),
  observaciones:    text('observaciones'),
  usuario_cierre_id: text('usuario_cierre_id'),
  supervisor_autorizacion_id: text('supervisor_autorizacion_id'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const venta = sqliteTable('venta', {
  id:               text('id').primaryKey(),
  numero_interno:   text('numero_interno').notNull().unique(),
  fecha:            integer('fecha', { mode: 'timestamp' }).notNull(),
  cliente_id:       text('cliente_id').notNull().references(() => cliente.id),
  usuario_id:       text('usuario_id').notNull().references(() => usuario.id),
  caja_id:          text('caja_id').notNull().references(() => caja.id),
  subtotal:         real('subtotal').notNull().default(0),
  descuento_global: real('descuento_global').notNull().default(0),
  importe_iva:      real('importe_iva').notNull().default(0),
  total:            real('total').notNull().default(0),
  ajuste_redondeo:  real('ajuste_redondeo').notNull().default(0),
  vuelto_centavos:  integer('vuelto_centavos'),
  forma_pago:       text('forma_pago', { enum: ['efectivo', 'cuenta_corriente', 'transferencia', 'tarjeta'] }).notNull(),
  estado:           text('estado', { enum: ['borrador', 'confirmada', 'anulada', 'en_espera', 'descartada'] }).notNull().default('borrador'),
  alias:            text('alias'),
  en_espera_desde:  integer('en_espera_desde', { mode: 'timestamp' }),
  turno_creacion_id: text('turno_creacion_id'),
  comprobante_id:   text('comprobante_id').references(() => comprobante.id),
  // ADR-046: se completa al convertir un presupuesto. TEXT sin .references() para
  // romper la circularidad venta↔presupuesto (la FK real vive en la migración 0025).
  presupuesto_id:   text('presupuesto_id'),
  observaciones:    text('observaciones'),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

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

export const movimiento_caja = sqliteTable('movimiento_caja', {
  id:              text('id').primaryKey(),
  caja_id:         text('caja_id').notNull().references(() => caja.id),
  tipo:            text('tipo', { enum: ['ingreso', 'egreso'] }).notNull(),
  motivo:          text('motivo', { enum: ['venta', 'cobro_cta_cte', 'pago_proveedor', 'retiro', 'aporte', 'gasto', 'ajuste'] }).notNull(),
  monto:           real('monto').notNull(),
  forma_pago:      text('forma_pago'),
  referencia_tipo: text('referencia_tipo').notNull(),
  referencia_id:   text('referencia_id').notNull(),
  usuario_id:      text('usuario_id').notNull(),
  fecha:           integer('fecha', { mode: 'timestamp' }).notNull(),
  observaciones:   text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const venta_pago = sqliteTable('venta_pago', {
  id:               text('id').primaryKey(),
  venta_id:         text('venta_id').notNull().references(() => venta.id),
  medio_pago:       text('medio_pago', {
    enum: ['efectivo', 'tarjeta', 'cuenta_corriente', 'transferencia', 'cheque'],
  }).notNull(),
  monto_centavos:   integer('monto_centavos').notNull(),
  recargo_pct:      real('recargo_pct').notNull().default(0),
  recargo_centavos: integer('recargo_centavos').notNull().default(0),
  numero_cheque:    text('numero_cheque'),
  banco:            text('banco'),
  fecha_cheque:     integer('fecha_cheque', { mode: 'timestamp' }),
  titular_cheque:   text('titular_cheque'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
