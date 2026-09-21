import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const rol = sqliteTable('rol', {
  id:          text('id').primaryKey(),
  nombre:      text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
  es_sistema:  integer('es_sistema', { mode: 'boolean' }).notNull().default(false),
  activo:      integer('activo', { mode: 'boolean' }).notNull().default(true),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const permiso = sqliteTable('permiso', {
  id:          text('id').primaryKey(),
  codigo:      text('codigo').notNull().unique(),
  descripcion: text('descripcion'),
  modulo:      text('modulo'),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const rol_permiso = sqliteTable('rol_permiso', {
  id:         text('id').primaryKey(),
  rol_id:     text('rol_id').notNull().references(() => rol.id),
  permiso_id: text('permiso_id').notNull().references(() => permiso.id),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const usuario = sqliteTable('usuario', {
  id:              text('id').primaryKey(),
  nombre_usuario:  text('nombre_usuario').notNull().unique(),
  nombre_completo: text('nombre_completo').notNull(),
  hash_password:   text('hash_password').notNull(),
  rol_id:          text('rol_id').notNull().references(() => rol.id),
  email:           text('email'),
  activo:          integer('activo', { mode: 'boolean' }).notNull().default(true),
  ultimo_acceso:   integer('ultimo_acceso', { mode: 'timestamp' }),
  usuario_creacion_id: text('usuario_creacion_id').notNull(),
  fecha_creacion: integer('fecha_creacion', { mode: 'timestamp' }).notNull(),
  usuario_modificacion_id: text('usuario_modificacion_id'),
  fecha_actualizacion: integer('fecha_actualizacion', { mode: 'timestamp' }),
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const usuario_preferencias = sqliteTable('usuario_preferencias', {
  id:          text('id').primaryKey(),
  usuario_id:  text('usuario_id').notNull().unique().references(() => usuario.id),
  tema:        text('tema', { enum: ['claro', 'oscuro'] }).notNull().default('claro'),
  acento:      text('acento', { enum: ['amber', 'blue', 'green', 'violet', 'brick'] }).notNull().default('blue'),
  ui_font:     text('ui_font', { enum: ['Hanken Grotesk', 'Inter', 'IBM Plex Sans', 'Atkinson Hyperlegible', 'Nunito', 'Barlow Semi Condensed'] }).notNull().default('Hanken Grotesk'),
  densidad:    text('densidad', { enum: ['comfortable', 'compact'] }).notNull().default('comfortable'),
  // Modo/skin de la app (ADR-086). El Tema manda el color; el Modo, la geometría
  // (espaciado, radios, sombra, ancho de sidebar, tratamiento de nav y tabla). Reemplaza al
  // control de Densidad: `densidad` se DERIVA del modo en la capa de aplicación al DOM
  // (maximizar→compact, resto→comfortable); la columna `densidad` se conserva (aditividad).
  skin:        text('skin', { enum: ['actual', 'maximizar', 'confortable'] }).notNull().default('actual'),
  pantalla_inicio: text('pantalla_inicio'), // null = usar el default por rol (ADR-080)
  favoritos:       text('favoritos').notNull().default('[]'), // JSON array de paths de navegación (ADR-080)
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state', { enum: ['pending', 'synced', 'conflict'] }).notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
