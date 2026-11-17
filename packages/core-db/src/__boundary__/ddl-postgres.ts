// packages/core-db/src/__boundary__/ddl-postgres.ts
// Baranda B3 (ADR-149): el esquema Postgres del hub se GENERA desde las tablas Drizzle de cada app;
// no se mantiene un segundo esquema a mano. Puro: no abre conexiones. Lo aplica en PGlite un test
// del núcleo (tablas del núcleo) y uno por app (tablas + índices de la base migrada).
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable, type SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { RegistroSync } from './registro-sync';

/** Mapa de tipos SQLite (Drizzle) → Postgres, fijado en ADR-149 §3. */
const TIPOS: Readonly<Record<string, string>> = {
  SQLiteText: 'text',
  SQLiteTextJson: 'text',
  SQLiteBoolean: 'boolean',
  SQLiteInteger: 'bigint',
  SQLiteTimestamp: 'bigint', // timestamps Unix
  SQLiteReal: 'double precision', // dinero en pesos REAL: deuda legacy hasta la serie de centavos de F1
  SQLiteNumeric: 'numeric',
  SQLiteBigInt: 'bigint',
  SQLiteBlobJson: 'bytea',
  SQLiteBlobBuffer: 'bytea',
};

const q = (nombre: string) => `"${nombre}"`;

function tipoPostgres(tabla: string, col: SQLiteColumn): string {
  const t = TIPOS[col.columnType];
  if (!t) throw new Error(`TIPO_SIN_MAPEO: ${tabla}.${col.name} (${col.columnType})`);
  return t;
}

/** Tablas del esquema que van al hub (`maestro` y `libro`), con su config de Drizzle. */
function tablasDelHub(schema: Record<string, unknown>, registro: RegistroSync) {
  const out: ReturnType<typeof getTableConfig>[] = [];
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    const tipo = registro[cfg.name]?.tipo;
    if (tipo === 'maestro' || tipo === 'libro') out.push(cfg);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sentencias DDL Postgres para las tablas que sincronizan: `CREATE TABLE` con tipos mapeados,
 * NOT NULL, PRIMARY KEY y UNIQUE; después las FK entre tablas del hub como `ALTER TABLE`
 * (diferibles: el hub aplica lotes de cambios de varias tablas). Las FK hacia tablas `local`
 * (geo, por ejemplo) se omiten porque esas tablas no existen en el hub. Los defaults no se
 * generan: el hub recibe filas completas. Los índices no salen de acá: los lee cada app de su
 * base migrada (ver `traducirIndicePostgres`), porque varios solo existen en las migraciones SQL.
 */
export function ddlPostgres(schema: Record<string, unknown>, registro: RegistroSync): string[] {
  const tablas = tablasDelHub(schema, registro);
  const enHub = new Set(tablas.map((t) => t.name));
  const creates: string[] = [];
  const fks: string[] = [];
  for (const cfg of tablas) {
    const defs = cfg.columns.map((col) => {
      let d = `${q(col.name)} ${tipoPostgres(cfg.name, col)}`;
      if (col.notNull || col.primary) d += ' NOT NULL';
      if (col.primary) d += ' PRIMARY KEY';
      if (col.isUnique) d += ' UNIQUE';
      return d;
    });
    for (const pk of cfg.primaryKeys) defs.push(`PRIMARY KEY (${pk.columns.map((c) => q(c.name)).join(', ')})`);
    for (const u of cfg.uniqueConstraints) defs.push(`UNIQUE (${u.columns.map((c) => q(c.name)).join(', ')})`);
    creates.push(`CREATE TABLE ${q(cfg.name)} (\n  ${defs.join(',\n  ')}\n);`);
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const destino = getTableConfig(ref.foreignTable).name;
      if (!enHub.has(destino)) continue;
      fks.push(
        `ALTER TABLE ${q(cfg.name)} ADD FOREIGN KEY (${ref.columns.map((c) => q(c.name)).join(', ')}) ` +
          `REFERENCES ${q(destino)} (${ref.foreignColumns.map((c) => q(c.name)).join(', ')}) DEFERRABLE INITIALLY DEFERRED;`,
      );
    }
  }
  return [...creates, ...fks];
}

/** Columnas booleanas por tabla (para traducir los predicados `= 1/0` de los índices). */
export function columnasBooleanas(schema: Record<string, unknown>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    out.set(cfg.name, new Set(cfg.columns.filter((c) => c.columnType === 'SQLiteBoolean').map((c) => c.name)));
  }
  return out;
}

/**
 * Traduce el SQL de un índice tal como lo guarda SQLite (`sqlite_master.sql`) a Postgres:
 * backticks → comillas dobles, y en las columnas booleanas `= 1`/`= 0` → `= true`/`= false`
 * (en el hub son `boolean`, ADR-149 §3).
 */
export function traducirIndicePostgres(sql: string, booleanas: ReadonlySet<string>): string {
  let out = sql.replace(/`([^`]+)`/g, '"$1"');
  for (const col of booleanas) {
    // Con o sin comillas (las migraciones escritas a mano no siempre las usan); los límites evitan
    // tocar otra columna que contenga el nombre (`no_preferido` no es `preferido`).
    const ident = `("${col}"|(?<![\\w"])${col}(?![\\w"]))`;
    out = out
      .replace(new RegExp(`${ident}\\s*=\\s*1\\b`, 'g'), '$1 = true')
      .replace(new RegExp(`${ident}\\s*=\\s*0\\b`, 'g'), '$1 = false');
  }
  return out;
}
