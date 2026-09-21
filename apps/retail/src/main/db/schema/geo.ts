import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const provincia = sqliteTable('provincia', { // NOSONAR
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  nombreNorm: text('nombre_norm').notNull(),
});

export const departamento = sqliteTable( // NOSONAR
  'departamento',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    nombreNorm: text('nombre_norm').notNull(),
    provinciaId: text('provincia_id')
      .notNull()
      .references(() => provincia.id),
  },
  (t) => ({
    idxProv: index('idx_depto_prov').on(t.provinciaId),
  })
);

export const localidad = sqliteTable( // NOSONAR
  'localidad',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    nombreNorm: text('nombre_norm').notNull(),
    provinciaId: text('provincia_id')
      .notNull()
      .references(() => provincia.id),
    departamentoId: text('departamento_id').references(() => departamento.id),
    codigoPostal: text('codigo_postal'),
  },
  (t) => ({
    idxProv: index('idx_loc_prov').on(t.provinciaId),
    idxNorm: index('idx_loc_norm').on(t.nombreNorm),
    idxCp: index('idx_loc_cp').on(t.codigoPostal),
  })
);
