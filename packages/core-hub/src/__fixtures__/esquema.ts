// Esquema de prueba del almacén del hub: un maestro con índice único, un hijo con FK, un libro y una
// tabla con columna proyectada. Imita la forma de las tablas reales (id texto + campos de sync).
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import type { RegistroSync } from '@core/db';

const sync = {
  version:    integer('version').notNull().default(1),
  origin_id:  text('origin_id').notNull(),
  sync_state: text('sync_state').notNull().default('pending'),
  updated_at: integer('updated_at').notNull(),
};

export const marca = sqliteTable('marca', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  ...sync,
});

export const articulo = sqliteTable('articulo', {
  id: text('id').primaryKey(),
  marca_id: text('marca_id').references(() => marca.id),
  nombre: text('nombre').notNull(),
  stock: real('stock').notNull(),            // proyectada (sin default, como un saldo NOT NULL)
  ...sync,
});

export const movimiento = sqliteTable('movimiento', {
  id: text('id').primaryKey(),
  articulo_id: text('articulo_id').notNull().references(() => articulo.id),
  cantidad: real('cantidad').notNull(),
  ...sync,
});

export const nota_local = sqliteTable('nota_local', {
  id: text('id').primaryKey(),
  texto: text('texto'),
});

export const esquemaPrueba = { marca, articulo, movimiento, nota_local };

export const registroPrueba: RegistroSync = {
  marca: { tipo: 'maestro' },
  articulo: { tipo: 'maestro', proyectadas: ['stock'] },
  movimiento: { tipo: 'libro' },
  nota_local: { tipo: 'local' },
};
