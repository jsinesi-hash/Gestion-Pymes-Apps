import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { PGlite } from '@electric-sql/pglite';
import { columnasBooleanas, ddlPostgres, traducirIndicePostgres } from '@core/db';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';
import { createTestDb } from './helpers';

// B3 (ADR-149): el esquema de Elaborados que sincroniza compila en Postgres. Las tablas salen de
// Drizzle; los índices, de la base SQLite migrada (varios, como los únicos parciales, solo existen
// en las migraciones SQL).
describe('B3 — Elaborados en Postgres (PGlite)', () => {
  it('las tablas y los índices de lo que sincroniza se crean en Postgres', async () => {
    const registro = registroSyncElaborados();
    const hub = new Set(Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t));
    const db = createTestDb();
    const indices = db
      .all<{ name: string; tbl_name: string; sql: string | null }>(
        sql`select name, tbl_name, sql from sqlite_master where type = 'index' and sql is not null`,
      )
      .filter((i) => hub.has(i.tbl_name));
    const booleanas = columnasBooleanas(schema);

    const pg = new PGlite();
    try {
      await pg.exec(ddlPostgres(schema, registro).join('\n'));
      for (const i of indices) {
        const ddl = traducirIndicePostgres(i.sql!, booleanas.get(i.tbl_name) ?? new Set());
        await pg.exec(ddl).catch((e: Error) => {
          throw new Error(`índice ${i.name} no compila en Postgres: ${e.message}\n${ddl}`);
        });
      }
      const tablas = await pg.query<{ n: number }>("select count(*)::int as n from information_schema.tables where table_schema = 'public'");
      expect(tablas.rows[0].n).toBe(hub.size);
      expect(indices.length).toBeGreaterThan(0);
    } finally {
      await pg.close();
    }
  });
});
