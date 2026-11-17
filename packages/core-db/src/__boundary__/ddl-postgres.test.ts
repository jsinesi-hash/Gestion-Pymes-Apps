import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import * as coreSchema from '../schema';
import { registroSyncCore, type RegistroSync } from './registro-sync';
import { ddlPostgres, traducirIndicePostgres } from './ddl-postgres';

const sync = {
  version: integer('version').notNull().default(1),
  origin_id: text('origin_id').notNull(),
  sync_state: text('sync_state').notNull().default('pending'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
};
const zona = sqliteTable('zona', { id: text('id').primaryKey() });
const padre = sqliteTable('padre', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  monto: real('monto'),
  zona_id: text('zona_id').references(() => zona.id),
  ...sync,
});
const hijo = sqliteTable('hijo', { id: text('id').primaryKey(), padre_id: text('padre_id').notNull().references(() => padre.id), ...sync });
const registro: RegistroSync = { zona: { tipo: 'local' }, padre: { tipo: 'maestro' }, hijo: { tipo: 'libro' } };

describe('ddlPostgres', () => {
  const ddl = ddlPostgres({ zona, padre, hijo }, registro).join('\n');

  it('genera solo las tablas que sincronizan (maestro y libro)', () => {
    expect(ddl).toContain('CREATE TABLE "padre"');
    expect(ddl).toContain('CREATE TABLE "hijo"');
    expect(ddl).not.toContain('CREATE TABLE "zona"');
  });

  it('mapea los tipos según ADR-149', () => {
    expect(ddl).toMatch(/"id" text NOT NULL PRIMARY KEY/);
    expect(ddl).toMatch(/"activo" boolean NOT NULL/);
    expect(ddl).toMatch(/"monto" double precision/);
    expect(ddl).toMatch(/"version" bigint NOT NULL/);
    expect(ddl).toMatch(/"updated_at" bigint NOT NULL/);
  });

  it('conserva UNIQUE y las FK entre tablas del hub (diferibles); omite las FK a tablas locales', () => {
    expect(ddl).toMatch(/"nombre" text NOT NULL UNIQUE/);
    expect(ddl).toMatch(/FOREIGN KEY \("padre_id"\) REFERENCES "padre" \("id"\) DEFERRABLE INITIALLY DEFERRED/);
    expect(ddl).not.toMatch(/REFERENCES "zona"/);
  });

  it('el DDL se aplica en Postgres real (PGlite)', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(ddl);
      const r = await pg.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' order by 1",
      );
      expect(r.rows.map((x) => x.table_name)).toEqual(['hijo', 'padre']);
    } finally {
      await pg.close();
    }
  });
});

describe('traducirIndicePostgres', () => {
  it('pasa backticks a comillas dobles', () => {
    expect(traducirIndicePostgres('CREATE INDEX `ix_a` ON `padre` (`nombre`);', new Set())).toBe(
      'CREATE INDEX "ix_a" ON "padre" ("nombre");',
    );
  });

  it('compara columnas booleanas con true/false en vez de 1/0', () => {
    const sql = 'CREATE UNIQUE INDEX `u` ON `padre` (`nombre`) WHERE `activo` = 1 AND "otra" = 0';
    expect(traducirIndicePostgres(sql, new Set(['activo', 'otra']))).toBe(
      'CREATE UNIQUE INDEX "u" ON "padre" ("nombre") WHERE "activo" = true AND "otra" = false',
    );
  });

  it('también traduce columnas booleanas escritas sin comillas (migraciones a mano)', () => {
    const sql = 'CREATE UNIQUE INDEX ux_p ON producto_proveedor(producto_id)\n  WHERE preferido = 1 AND deleted_at IS NULL';
    expect(traducirIndicePostgres(sql, new Set(['preferido']))).toBe(
      'CREATE UNIQUE INDEX ux_p ON producto_proveedor(producto_id)\n  WHERE preferido = true AND deleted_at IS NULL',
    );
  });

  it('no confunde una columna booleana con otra que la contiene en el nombre', () => {
    const sql = 'CREATE INDEX i ON t (x) WHERE no_preferido = 1';
    expect(traducirIndicePostgres(sql, new Set(['preferido']))).toBe(sql);
  });

  it('no toca comparaciones numéricas de columnas que no son booleanas', () => {
    const sql = 'CREATE INDEX "i" ON "padre" ("monto") WHERE "monto" = 1';
    expect(traducirIndicePostgres(sql, new Set(['activo']))).toBe(sql);
  });
});

describe('B3 del núcleo', () => {
  it('las tablas del núcleo que sincronizan se crean en Postgres', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(ddlPostgres(coreSchema, registroSyncCore()).join('\n'));
      const r = await pg.query<{ n: number }>(
        "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
      );
      const hub = Object.values(registroSyncCore()).filter((e) => e.tipo !== 'local').length;
      expect(r.rows[0].n).toBe(hub);
    } finally {
      await pg.close();
    }
  });
});
