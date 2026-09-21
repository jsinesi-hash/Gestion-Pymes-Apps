import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { venta, venta_detalle, comprobante } from './ventas';
import { producto } from './catalog';
import { usuario } from './seguridad';

// ADR-045 (iteracion 2): catalogo de transportistas. Sin campos fiscales:
// el transportista no le factura a la ferreteria, es un dato operativo.
export const transportista = sqliteTable('transportista', {
  id:               text('id').primaryKey(),
  razon_social:     text('razon_social').notNull(),
  telefono:         text('telefono'),
  email:            text('email'),
  persona_contacto: text('persona_contacto'),
  domicilio:        text('domicilio'),
  observaciones:    text('observaciones'),
  activo:           integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ADR-045: Remito = documento de entrega interno. NO mueve stock ni caja;
// solo lee de venta/venta_detalle/comprobante/cliente/producto/transportista.
export const remito = sqliteTable('remito', {
  id:                  text('id').primaryKey(),
  // numero_secuencial y numero se asignan AL EMITIR, nunca antes (ADR-045 §5)
  numero_secuencial:   integer('numero_secuencial').notNull(),
  numero:              text('numero').notNull().unique(),
  venta_id:            text('venta_id').notNull().references(() => venta.id),
  // Informativo: qué comprobante respalda esta entrega. El M:N real se difiere (ADR-045 §6).
  comprobante_id:      text('comprobante_id').references(() => comprobante.id),
  estado:              text('estado', { enum: ['emitido', 'conformado', 'anulado'] }).notNull().default('emitido'),
  fecha_emision:       integer('fecha_emision', { mode: 'timestamp' }).notNull(),
  fecha_entrega:       integer('fecha_entrega', { mode: 'timestamp' }),
  recibido_por:        text('recibido_por'),
  // Snapshot: puede diferir del domicilio del cliente
  domicilio_entrega:   text('domicilio_entrega'),
  // ADR-045 iter. 2: transportista_id es la referencia al catalogo; `transportista`
  // (texto) pasa a ser el snapshot del nombre al momento de emitir/editar. Remitos
  // previos a esta migracion quedan con transportista_id = null (dato historico).
  transportista_id:    text('transportista_id').references(() => transportista.id),
  transportista:       text('transportista'),
  observaciones:       text('observaciones'),
  anulado_en:              integer('anulado_en', { mode: 'timestamp' }),
  anulado_por_usuario_id:  text('anulado_por_usuario_id').references(() => usuario.id),
  motivo_anulacion:        text('motivo_anulacion'),
  activo:              integer('activo', { mode: 'boolean' }).notNull().default(true),
  creado_por_usuario_id: text('creado_por_usuario_id').notNull().references(() => usuario.id),
  creado_en:           integer('creado_en', { mode: 'timestamp' }).notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const remito_linea = sqliteTable('remito_linea', {
  id:                 text('id').primaryKey(),
  remito_id:          text('remito_id').notNull().references(() => remito.id),
  // ADR-045 §5 la llama "venta_linea"; la tabla real del repo es venta_detalle
  venta_detalle_id:   text('venta_detalle_id').notNull().references(() => venta_detalle.id),
  // Misma unidad que venta_detalle.cantidad (unidades de presentación, ADR-040)
  cantidad_entregada: real('cantidad_entregada').notNull(),
  // Snapshots inmutables — SIN importes (ADR-045 §4)
  producto_id:        text('producto_id').notNull().references(() => producto.id),
  descripcion:        text('descripcion').notNull(),
  unidad:             text('unidad'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
