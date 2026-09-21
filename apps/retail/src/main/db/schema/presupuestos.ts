import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { cliente } from './personas';
import { usuario } from './seguridad';
import { producto, producto_presentacion } from './catalog';
import { venta } from './ventas';

// ADR-046: Presupuesto = cotización previa a la venta. Entidad nueva.
// Invariantes: montos en centavos (INTEGER); descuentos como % (REAL, igual que el
// runtime del POS); soft-delete via `activo`; UUID PK; snapshot de precio congelado
// al EMITIR (no en borrador). numero/fecha_emision/fecha_validez null hasta emitir.
export const presupuesto = sqliteTable('presupuesto', {
  id:                    text('id').primaryKey(),
  // numero_secuencial y numero se asignan AL EMITIR, nunca en borrador (ADR-046 §2)
  numero_secuencial:     integer('numero_secuencial'),
  numero:                text('numero').unique(),
  // null = consumidor final
  cliente_id:            text('cliente_id').references(() => cliente.id),
  estado:                text('estado', {
    enum: ['borrador', 'emitido', 'vencido', 'convertido', 'anulado'],
  }).notNull().default('borrador'),
  fecha_emision:         integer('fecha_emision', { mode: 'timestamp' }),
  validez_dias:          integer('validez_dias').notNull(),
  // fecha_emision + validez_dias, calculada al emitir
  fecha_validez:         integer('fecha_validez', { mode: 'timestamp' }),
  descuento_global_pct:  real('descuento_global_pct').notNull().default(0),
  total_centavos:        integer('total_centavos').notNull().default(0),
  usuario_id:            text('usuario_id').notNull().references(() => usuario.id),
  // se completa al convertir
  venta_id:              text('venta_id').references(() => venta.id),
  observaciones:         text('observaciones'),
  activo:                integer('activo', { mode: 'boolean' }).notNull().default(true),
  creado_por_usuario_id: text('creado_por_usuario_id').notNull().references(() => usuario.id),
  creado_en:             integer('creado_en', { mode: 'timestamp' }).notNull(),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const presupuesto_detalle = sqliteTable('presupuesto_detalle', {
  id:                       text('id').primaryKey(),
  presupuesto_id:           text('presupuesto_id').notNull().references(() => presupuesto.id),
  producto_id:              text('producto_id').notNull().references(() => producto.id),
  // Snapshot inmutable (como venta_detalle)
  descripcion:              text('descripcion').notNull(),
  cantidad:                 real('cantidad').notNull(),
  // null = precio sin congelar (borrador). Se congela al emitir con el motor de precios.
  precio_unitario_centavos: integer('precio_unitario_centavos'),
  descuento_linea_pct:      real('descuento_linea_pct').notNull().default(0),
  // Snapshot de alícuota al momento (como venta_detalle)
  alicuota_iva:             real('alicuota_iva').notNull().default(0),
  subtotal_centavos:        integer('subtotal_centavos').notNull().default(0),
  // Coherencia con multi-presentación (ADR-040)
  presentacion_id:          text('presentacion_id').references(() => producto_presentacion.id),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
