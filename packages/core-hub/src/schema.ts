import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

/**
 * Tablas propias del hub (ADR-150 §4 y §5). Viven en la misma base SQLite que las tablas de la app
 * (ADR-149 §2), con su migración aparte (`__drizzle_migrations_hub`). No las ve ninguna terminal.
 */

/**
 * Registro de cambios aceptados: `seq` es el cursor del protocolo (ADR-150 §6), nunca la hora de una
 * terminal. `fila` es la fila tal como quedó en el hub, sin columnas proyectadas (ADR-151).
 */
export const hub_cambio = sqliteTable('hub_cambio', {
  seq:         integer('seq').primaryKey({ autoIncrement: true }),
  tabla:       text('tabla').notNull(),
  fila_id:     text('fila_id').notNull(),
  version:     integer('version').notNull(),
  origin_id:   text('origin_id').notNull(),   // terminal que escribió este estado
  updated_at:  integer('updated_at').notNull(),
  fila:        text('fila').notNull(),         // JSON
  recibido_en: integer('recibido_en').notNull(),
}, (t) => [index('hub_cambio_fila_idx').on(t.tabla, t.fila_id, t.seq)]);

/** Lo que ya se recibió, por `(tabla, id, versión, origin_id)`: un reenvío devuelve el mismo resultado. */
export const hub_recibido = sqliteTable('hub_recibido', {
  tabla:     text('tabla').notNull(),
  fila_id:   text('fila_id').notNull(),
  version:   integer('version').notNull(),
  origin_id: text('origin_id').notNull(),
  resultado: text('resultado', { enum: ['aplicado', 'perdio', 'unicidad', 'integridad'] }).notNull(),
  seq:       integer('seq'),
}, (t) => [primaryKey({ columns: [t.tabla, t.fila_id, t.version, t.origin_id] })]);

/** Log de conflictos que revisa el Supervisor (ADR-012, ADR-150 §5). */
export const hub_conflicto = sqliteTable('hub_conflicto', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  tipo:           text('tipo', { enum: ['lww', 'unicidad', 'integridad'] }).notNull(),
  tabla:          text('tabla').notNull(),
  fila_id:        text('fila_id').notNull(),
  origin_id:      text('origin_id').notNull(), // terminal del cambio que entró
  fila_entrante:  text('fila_entrante').notNull(),
  fila_actual:    text('fila_actual'),
  detalle:        text('detalle'),
  fecha:          integer('fecha').notNull(),
  resuelto:       integer('resuelto', { mode: 'boolean' }).notNull().default(false),
});
