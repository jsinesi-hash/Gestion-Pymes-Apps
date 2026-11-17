// packages/core-db/src/__boundary__/triggers-sync.ts
// Captura de cambios (ADR-150 §4 y §6): triggers AFTER INSERT/UPDATE generados desde el registro de
// sync, que encolan en `sync_outbox` cada cambio de una tabla `maestro` o `libro`. Se instalan SOLO en
// modo distribuido (F1 PR8 conecta el modo): en standalone nadie consume la cola y crecería sin fin.
import type * as BetterSqlite3 from 'better-sqlite3';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { RegistroSync } from './registro-sync';

const q = (nombre: string) => `"${nombre}"`;

/** Columnas por `json_object` (2 argumentos por columna; SQLite admite 127 por defecto). */
const COLUMNAS_POR_JSON = 50;

/** Campos de sync que no cuentan como cambio de datos (los mueve el propio trigger o el push). */
const NO_SON_CAMBIO = new Set(['version', 'sync_state', 'updated_at']);

interface TablaCaptura {
  nombre: string;
  datos: string[]; // columnas que viajan (todas menos las proyectadas)
}

function tablasCaptura(schema: Record<string, unknown>, registro: RegistroSync): TablaCaptura[] {
  const out: TablaCaptura[] = [];
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    const entrada = registro[cfg.name];
    if (entrada?.tipo !== 'maestro' && entrada?.tipo !== 'libro') continue;
    const cols = cfg.columns.map((c) => c.name);
    if (!cols.includes('id')) throw new Error(`TRIGGER_SIN_ID: ${cfg.name}`);
    const proyectadas = new Set(entrada.proyectadas ?? []);
    out.push({ nombre: cfg.name, datos: cols.filter((c) => !proyectadas.has(c)) });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function jsonFila(datos: string[]): string {
  const partes: string[] = [];
  for (let i = 0; i < datos.length; i += COLUMNAS_POR_JSON) {
    const pares = datos.slice(i, i + COLUMNAS_POR_JSON).map((c) => `'${c}', ${q(c)}`);
    partes.push(`json_object(${pares.join(', ')})`);
  }
  return partes.reduce((acc, p) => `json_patch(${acc}, ${p})`);
}

function encolar(t: TablaCaptura, operacion: 'insert' | 'update'): string {
  return (
    `INSERT INTO "sync_outbox" ("tabla", "fila_id", "operacion", "version", "fila", "fecha")\n` +
    `    SELECT '${t.nombre}', "id", '${operacion}', "version", ${jsonFila(t.datos)}, CAST(strftime('%s', 'now') AS INTEGER)\n` +
    `    FROM ${q(t.nombre)} WHERE "id" = NEW."id";`
  );
}

const NO_APLICANDO = 'NOT EXISTS (SELECT 1 FROM "sync_aplicando")';

function triggersDe(t: TablaCaptura): [string, string] {
  const ins =
    `CREATE TRIGGER ${q(`sync_ins_${t.nombre}`)} AFTER INSERT ON ${q(t.nombre)}\n` +
    `WHEN ${NO_APLICANDO}\nBEGIN\n` +
    `  UPDATE ${q(t.nombre)} SET "sync_state" = 'pending' WHERE "id" = NEW."id" AND "sync_state" <> 'pending';\n` +
    `  ${encolar(t, 'insert')}\nEND;`;
  // Solo encola si cambió un dato que viaja: un cambio de saldo proyectado, o el propio UPDATE de
  // este trigger (versión y estado), no es un cambio para el hub.
  const cambio = t.datos
    .filter((c) => !NO_SON_CAMBIO.has(c))
    .map((c) => `OLD.${q(c)} IS NOT NEW.${q(c)}`)
    .join(' OR ');
  const upd =
    `CREATE TRIGGER ${q(`sync_upd_${t.nombre}`)} AFTER UPDATE ON ${q(t.nombre)}\n` +
    `WHEN ${NO_APLICANDO} AND (${cambio || '0'})\nBEGIN\n` +
    `  UPDATE ${q(t.nombre)} SET "version" = CASE WHEN NEW."version" = OLD."version" THEN OLD."version" + 1 ELSE NEW."version" END,\n` +
    `    "sync_state" = 'pending' WHERE "id" = NEW."id";\n` +
    `  ${encolar(t, 'update')}\nEND;`;
  return [ins, upd];
}

/** Sentencias `CREATE TRIGGER` de captura para cada tabla `maestro`/`libro` del esquema. */
export function triggersSync(schema: Record<string, unknown>, registro: RegistroSync): string[] {
  return tablasCaptura(schema, registro).flatMap(triggersDe);
}

/** Nombres de los triggers de captura que corresponden al esquema (para instalarlos, quitarlos y verificarlos). */
export function nombresTriggersSync(schema: Record<string, unknown>, registro: RegistroSync): string[] {
  return tablasCaptura(schema, registro).flatMap((t) => [`sync_ins_${t.nombre}`, `sync_upd_${t.nombre}`]);
}

/** Instala (o reinstala) los triggers de captura. Idempotente. Solo para modo distribuido. */
export function instalarTriggersSync(
  sqlite: BetterSqlite3.Database,
  schema: Record<string, unknown>,
  registro: RegistroSync,
): void {
  sqlite.transaction(() => {
    for (const n of nombresTriggersSync(schema, registro)) sqlite.exec(`DROP TRIGGER IF EXISTS ${q(n)};`);
    for (const s of triggersSync(schema, registro)) sqlite.exec(s);
  })();
}

/** Quita los triggers de captura (volver a standalone). */
export function desinstalarTriggersSync(
  sqlite: BetterSqlite3.Database,
  schema: Record<string, unknown>,
  registro: RegistroSync,
): void {
  sqlite.transaction(() => {
    for (const n of nombresTriggersSync(schema, registro)) sqlite.exec(`DROP TRIGGER IF EXISTS ${q(n)};`);
  })();
}

/**
 * Corre `fn` como "aplicación de cambios recibidos del hub" (ADR-150 §6): en una transacción, con el
 * interruptor encendido, para que nada de lo escrito vuelva a la cola. El interruptor se apaga antes
 * del COMMIT; si `fn` falla, el ROLLBACK lo deshace igual.
 */
export function aplicandoCambiosRecibidos<T>(sqlite: BetterSqlite3.Database, fn: () => T): T {
  return sqlite.transaction(() => {
    sqlite.prepare('INSERT INTO "sync_aplicando" ("id") VALUES (1)').run();
    const r = fn();
    sqlite.prepare('DELETE FROM "sync_aplicando"').run();
    return r;
  })();
}
