// Base de datos de pruebas del NÚCLEO, sin depender de las migraciones de ninguna app.
//
// `@core/db` no tiene migraciones propias (cada app tiene su secuencia sobre el esquema compuesto),
// así que el esquema se genera una vez desde las tablas Drizzle con `drizzle-kit/api`. Solo sirve
// para tests: no entra en `index.ts` ni lo carga código de producción.
//
// `better-sqlite3` es un módulo nativo: estos tests (`*.db.test.ts`) corren bajo el runner de
// Electron (`scripts/test-node.cjs`), igual que los del main de las apps (CLAUDE.md, «Dos runners»).
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { createDb } from '@core/db';
import * as schema from '@core/db';

let sentencias: string[] | null = null;

/** Genera (una sola vez por proceso) las sentencias CREATE del esquema del núcleo. */
export async function prepararEsquemaCore(): Promise<void> {
  if (sentencias) return;
  // `require` nativo: vite-node no puede cargar el bundle de drizzle-kit ("Dynamic require of fs").
  const kit = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api');
  const vacio = await kit.generateSQLiteDrizzleJson({});
  const actual = await kit.generateSQLiteDrizzleJson(schema);
  sentencias = await kit.generateSQLiteMigration(vacio, actual);
}

/** BD en memoria con el esquema del núcleo. Requiere `await prepararEsquemaCore()` previo. */
export function createCoreTestDb() {
  if (!sentencias) throw new Error('createCoreTestDb: falta await prepararEsquemaCore() (setupFiles)');
  const sqlite = new Database(':memory:');
  const { db } = createDb(sqlite, schema);
  // Como `runMigrations`: crear tablas con FK cruzadas no debe depender del orden.
  sqlite.pragma('foreign_keys = OFF');
  for (const s of sentencias) sqlite.exec(s);
  sqlite.pragma('foreign_keys = ON');
  return db;
}
