import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// E4-PR3 (ADR-104): header de listas de precio, promovido desde Retail por regla de tres (2º consumidor:
// Elaborados). Es el header completo tal como lo creó la migración de Retail (incluye `modo_calculo`,
// que Elaborados no usa); los valores por producto viven en cada app (`lista_precio_valor`,
// `producto_venta_precio`).
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
