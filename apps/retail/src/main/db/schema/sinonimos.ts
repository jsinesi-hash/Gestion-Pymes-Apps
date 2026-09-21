import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';

// ADR-067 — Sinónimos de búsqueda para el catálogo de ferretería.
// Modelo de grupo: cada fila es un término; los términos equivalentes comparten `grupo_id`.
// Uno del grupo lleva `es_canonico = true` (el término "oficial"). La búsqueda normaliza
// lo tipeado (`termino_norm`), encuentra el grupo y expande a los demás términos.
export const sinonimo = sqliteTable('sinonimo', {
  id:            text('id').primaryKey(),
  grupo_id:      text('grupo_id').notNull(),
  termino:       text('termino').notNull(),          // tal cual, para mostrar/editar
  termino_norm:  text('termino_norm').notNull(),      // normalizado (lower, sin acentos) para match
  es_canonico:   integer('es_canonico', { mode: 'boolean' }).notNull().default(false),
  // ADR-067: abreviatura = término SOLO-ENTRADA (dispara la expansión al tipearlo, pero
  // nunca se usa como patrón de substring contra el nombre; evita que "torn" traiga
  // "destornillador" al buscar "tornillo").
  es_abreviatura: integer('es_abreviatura', { mode: 'boolean' }).notNull().default(false),
  rubro:         text('rubro'),                       // informativo (Herramientas, Plomería, …)
  nota:          text('nota'),                        // p. ej. advertencia de ambigüedad
  origen:        text('origen', { enum: ['seed', 'manual', 'import'] }).notNull().default('manual'),
  activo:        integer('activo', { mode: 'boolean' }).notNull().default(true),
  usuario_creacion_id:     text('usuario_creacion_id').notNull(),
  fecha_creacion:          integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion:     integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (t) => [
  index('idx_sinonimo_termino_norm').on(t.termino_norm),
  index('idx_sinonimo_grupo').on(t.grupo_id),
  // No duplicar el mismo término dentro de un grupo.
  unique('uq_sinonimo_grupo_termino').on(t.grupo_id, t.termino_norm),
]);
