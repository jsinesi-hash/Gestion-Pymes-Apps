import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { cliente } from './personas';
import { usuario } from './seguridad';

export const cuenta_corriente_cliente = sqliteTable('cuenta_corriente_cliente', {
  id:                      text('id').primaryKey(),
  cliente_id:              text('cliente_id').notNull().unique().references(() => cliente.id),
  saldo_centavos:          integer('saldo_centavos').notNull().default(0),  // + = cliente debe
  limite_credito_centavos: integer('limite_credito_centavos').notNull().default(0),
  fecha_ultimo_movimiento: integer('fecha_ultimo_movimiento', { mode: 'timestamp' }),
  activo:                  integer('activo', { mode: 'boolean' }).notNull().default(true),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const movimiento_cuenta_corriente = sqliteTable('movimiento_cuenta_corriente', {
  id:                        text('id').primaryKey(),
  cuenta_id:                 text('cuenta_id').notNull().references(() => cuenta_corriente_cliente.id),
  tipo:                      text('tipo', { enum: ['cargo', 'pago'] }).notNull(),
  motivo:                    text('motivo', {
    enum: ['venta_credito', 'cobro', 'nota_credito', 'nota_debito', 'ajuste', 'saldo_inicial'],
  }).notNull(),
  monto_centavos:            integer('monto_centavos').notNull(),       // siempre positivo
  saldo_resultante_centavos: integer('saldo_resultante_centavos').notNull(),
  referencia_tipo:           text('referencia_tipo'),
  referencia_id:             text('referencia_id'),
  usuario_id:                text('usuario_id').notNull().references(() => usuario.id),
  fecha:                     integer('fecha', { mode: 'timestamp' }).notNull(),
  observaciones:             text('observaciones'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
