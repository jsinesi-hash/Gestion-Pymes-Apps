// Almacén del hub (ADR-149 §1 y §2, ADR-150 §4 a §6 y §10). Genérico: no conoce ninguna tabla de
// ninguna app. Recibe el esquema compuesto y el registro de sync de la app que sirve, y opera con SQL
// armado desde `getTableConfig`, igual que los triggers de captura de `@core/db`.
import type * as BetterSqlite3 from 'better-sqlite3';
import { is } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { fileURLToPath } from 'node:url';
import { createDb, runMigrations, type RegistroSync } from '@core/db';

/** Un cambio tal como lo encola `sync_outbox` en la terminal: la fila completa, sin proyectadas. */
export interface CambioEntrante {
  readonly tabla: string;
  readonly fila: Readonly<Record<string, unknown>>;
}

export type EstadoCambio = 'aplicado' | 'perdio' | 'unicidad' | 'integridad';

/**
 * Resultado por cambio, en el orden del lote. `seq` es el número de secuencia que la terminal ve en
 * el pull: el del cambio aplicado o, si perdió, el del ganador reemitido. `duplicado` = ya se había
 * recibido (reenvío tras un corte).
 */
export interface ResultadoCambio {
  readonly estado: EstadoCambio;
  readonly seq?: number;
  readonly conflicto_id?: number;
  readonly duplicado?: true;
}

export interface CambioRegistrado {
  readonly seq: number;
  readonly tabla: string;
  readonly fila_id: string;
  readonly version: number;
  readonly origin_id: string;
  readonly updated_at: number;
  readonly fila: Record<string, unknown>;
}

export interface PaginaCambios {
  readonly cambios: CambioRegistrado[];
  /** Cursor para pedir la página siguiente (el último `seq` entregado, o el pedido si no hubo nada). */
  readonly hasta: number;
  readonly hayMas: boolean;
}

export interface Snapshot {
  readonly cursor: number;
  readonly tablas: { tabla: string; filas: Record<string, unknown>[] }[];
}

export interface ConflictoHub {
  readonly id: number;
  readonly tipo: 'lww' | 'unicidad' | 'integridad';
  readonly tabla: string;
  readonly fila_id: string;
  readonly origin_id: string;
  readonly fila_entrante: string;
  readonly fila_actual: string | null;
  readonly detalle: string | null;
  readonly fecha: number;
  readonly resuelto: number;
}

/** Operaciones del hub (ADR-149 §1). Postgres (F4) implementa la misma interfaz. */
export interface AlmacenHub {
  /** Aplica un lote de una terminal, en una transacción. `origen` es el `origin_id` autenticado. */
  aplicarLote(origen: string, cambios: readonly CambioEntrante[], ahora?: number): ResultadoCambio[];
  cambiosDesde(cursor: number, limite: number): PaginaCambios;
  snapshot(): Snapshot;
  conflictos(): ConflictoHub[];
  ultimoCursor(): number;
}

export interface OpcionesAlmacen {
  readonly schema: Record<string, unknown>;
  readonly registro: RegistroSync;
  /** Migraciones de la app: el hub tiene las mismas tablas e índices únicos que las terminales. */
  readonly migracionesApp: string;
  /** Migraciones propias del hub; por defecto, las de este paquete. */
  readonly migracionesHub?: string;
}

interface TablaHub {
  readonly nombre: string;
  readonly tipo: 'maestro' | 'libro';
  readonly columnas: ReadonlySet<string>;
  /** Columnas que viajan (todas menos las proyectadas). */
  readonly datos: readonly string[];
  readonly proyectadas: ReadonlySet<string>;
  /** Proyectadas NOT NULL sin default: un alta las completa con 0 (el valor se recalcula en cada nodo). */
  readonly proyectadasSinDefault: readonly string[];
}

const q = (n: string) => `"${n}"`;
/** Campos que no cuentan como contenido al comparar dos copias de un movimiento. */
const NO_SON_CONTENIDO = new Set(['version', 'sync_state', 'updated_at']);
const MIGRACIONES_HUB = fileURLToPath(new URL('../migrations', import.meta.url));

function tablasDelHub(schema: Record<string, unknown>, registro: RegistroSync): Map<string, TablaHub> {
  const out = new Map<string, TablaHub>();
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    const entrada = registro[cfg.name];
    if (entrada?.tipo !== 'maestro' && entrada?.tipo !== 'libro') continue;
    const proyectadas = new Set(entrada.proyectadas ?? []);
    out.set(cfg.name, {
      nombre: cfg.name,
      tipo: entrada.tipo,
      columnas: new Set(cfg.columns.map((c) => c.name)),
      datos: cfg.columns.map((c) => c.name).filter((c) => !proyectadas.has(c)),
      proyectadas,
      proyectadasSinDefault: cfg.columns.filter((c) => proyectadas.has(c.name) && c.notNull && !c.hasDefault).map((c) => c.name),
    });
  }
  return out;
}

function codigoSqlite(e: unknown): string {
  return (e as { code?: string } | null)?.code ?? '';
}

export function abrirAlmacenHub(sqlite: BetterSqlite3.Database, opts: OpcionesAlmacen): AlmacenHub {
  const { db } = createDb(sqlite, opts.schema);
  runMigrations(db, sqlite, opts.migracionesApp);
  migrate(drizzle(sqlite), {
    migrationsFolder: opts.migracionesHub ?? MIGRACIONES_HUB,
    migrationsTable: '__drizzle_migrations_hub',
  });
  const tablas = tablasDelHub(opts.schema, opts.registro);

  const stUltimo = sqlite.prepare(
    'SELECT seq, origin_id, version, updated_at FROM hub_cambio WHERE tabla = ? AND fila_id = ? ORDER BY seq DESC LIMIT 1',
  );
  const stRecibido = sqlite.prepare(
    'SELECT resultado, seq FROM hub_recibido WHERE tabla = ? AND fila_id = ? AND version = ? AND origin_id = ?',
  );
  const stMarcarRecibido = sqlite.prepare(
    'INSERT INTO hub_recibido (tabla, fila_id, version, origin_id, resultado, seq) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const stCambio = sqlite.prepare(
    'INSERT INTO hub_cambio (tabla, fila_id, version, origin_id, updated_at, fila, recibido_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const stConflicto = sqlite.prepare(
    'INSERT INTO hub_conflicto (tipo, tabla, fila_id, origin_id, fila_entrante, fila_actual, detalle, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );

  function tabla(nombre: string): TablaHub {
    const t = tablas.get(nombre);
    if (!t) throw new Error(`TABLA_NO_SINCRONIZA: ${nombre}`);
    return t;
  }

  /** Valida la forma del cambio y devuelve la fila que se guarda: sin proyectadas y como sincronizada. */
  function normalizar(c: CambioEntrante): { t: TablaHub; id: string; version: number; updated_at: number; fila: Record<string, unknown> } {
    const t = tabla(c.tabla);
    const f = c.fila ?? {};
    const id = f['id'];
    const version = f['version'];
    const updated_at = f['updated_at'];
    if (typeof id !== 'string' || !Number.isInteger(version) || typeof updated_at !== 'number') {
      throw new Error(`CAMBIO_INVALIDO: ${c.tabla}`);
    }
    const fila: Record<string, unknown> = {};
    for (const [col, valor] of Object.entries(f)) {
      if (!t.columnas.has(col)) throw new Error(`COLUMNA_DESCONOCIDA: ${t.nombre}.${col}`);
      if (t.proyectadas.has(col)) continue;
      fila[col] = valor;
    }
    if (t.columnas.has('sync_state')) fila['sync_state'] = 'synced';
    return { t, id, version: version as number, updated_at, fila };
  }

  function leerFila(t: TablaHub, id: string): Record<string, unknown> | undefined {
    return sqlite.prepare(`SELECT * FROM ${q(t.nombre)} WHERE "id" = ?`).get(id) as Record<string, unknown> | undefined;
  }

  function sinProyectadas(t: TablaHub, fila: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of t.datos) if (c in fila) out[c] = fila[c];
    return out;
  }

  function guardar(t: TablaHub, fila: Record<string, unknown>): void {
    const cols = Object.keys(fila);
    const relleno = t.proyectadasSinDefault.filter((c) => !(c in fila));
    const todas = [...cols, ...relleno];
    const valores = [...cols.map((c) => fila[c]), ...relleno.map(() => 0)];
    const set = cols.filter((c) => c !== 'id').map((c) => `${q(c)} = excluded.${q(c)}`).join(', ');
    sqlite.prepare(
      `INSERT INTO ${q(t.nombre)} (${todas.map(q).join(', ')}) VALUES (${todas.map(() => '?').join(', ')})` +
      (set ? ` ON CONFLICT("id") DO UPDATE SET ${set}` : ' ON CONFLICT("id") DO NOTHING'),
    ).run(...valores.map(aSqlite));
  }

  function registrarCambio(t: TablaHub, id: string, version: number, origen: string, updated_at: number, fila: Record<string, unknown>, ahora: number): number {
    return Number(stCambio.run(t.nombre, id, version, origen, updated_at, JSON.stringify(fila), ahora).lastInsertRowid);
  }

  function conflicto(tipo: ConflictoHub['tipo'], t: TablaHub, id: string, origen: string, entrante: unknown, actual: unknown, detalle: string | null, ahora: number): number {
    return Number(stConflicto.run(tipo, t.nombre, id, origen, JSON.stringify(entrante), actual == null ? null : JSON.stringify(actual), detalle, ahora).lastInsertRowid);
  }

  /** ¿El cambio entrante le gana al estado actual del hub? (ADR-150 §5) */
  function gana(origen: string, version: number, updated_at: number, ultimo: { origin_id: string; version: number; updated_at: number }): boolean {
    if (origen === ultimo.origin_id) return version > ultimo.version; // la misma terminal: su propio orden
    if (updated_at !== ultimo.updated_at) return updated_at > ultimo.updated_at;
    return origen < ultimo.origin_id;
  }

  function aplicarUno(origen: string, c: CambioEntrante, ahora: number): ResultadoCambio {
    const { t, id, version, updated_at, fila } = normalizar(c);
    const previo = stRecibido.get(t.nombre, id, version, origen) as { resultado: EstadoCambio; seq: number | null } | undefined;
    if (previo) return { estado: previo.resultado, ...(previo.seq != null ? { seq: previo.seq } : {}), duplicado: true };

    const actual = leerFila(t, id);
    const ultimo = stUltimo.get(t.nombre, id) as { seq: number; origin_id: string; version: number; updated_at: number } | undefined;

    let resultado: ResultadoCambio;
    // Misma fila que la del hub (otra copia de una fila que ya llegó, o un movimiento repetido): no es
    // un cambio ni un conflicto. Si la fila solo la sembró una migración del hub (sin `ultimo`), se
    // guarda igual la de la terminal, para que el hub quede con su hora y su versión.
    const igual = actual !== undefined && (ultimo !== undefined || t.tipo === 'libro')
      && t.datos.every((col) => NO_SON_CONTENIDO.has(col) || !(col in fila) || sonIguales(actual[col], fila[col]));
    if (igual) {
      stMarcarRecibido.run(t.nombre, id, version, origen, 'aplicado', ultimo?.seq ?? null);
      return { estado: 'aplicado', ...(ultimo ? { seq: ultimo.seq } : {}), duplicado: true };
    }
    if (actual && t.tipo === 'libro') {
      const cid = conflicto('integridad', t, id, origen, fila, sinProyectadas(t, actual), 'LIBRO_CON_OTRO_CONTENIDO', ahora);
      resultado = { estado: 'integridad', conflicto_id: cid };
    } else if (actual && ultimo && !gana(origen, version, updated_at, ultimo)) {
      // Sin `ultimo`, la fila del hub solo la sembró una de sus migraciones (Consumidor Final,
      // configuración del negocio): no la escribió nadie y el primer cambio de una terminal la pisa.
      const vigente = sinProyectadas(t, actual);
      const cid = conflicto('lww', t, id, origen, fila, vigente, null, ahora);
      // Se reemite el ganador: la terminal que perdió lo baja aunque su cursor ya haya pasado su seq.
      const seq = registrarCambio(t, id, Number(actual['version']), ultimo?.origin_id ?? String(actual['origin_id']), Number(actual['updated_at']), vigente, ahora);
      resultado = { estado: 'perdio', seq, conflicto_id: cid };
    } else {
      try {
        sqlite.transaction(() => guardar(t, fila))();
      } catch (e) {
        const codigo = codigoSqlite(e);
        if (!codigo.startsWith('SQLITE_CONSTRAINT') || codigo === 'SQLITE_CONSTRAINT_FOREIGNKEY') throw e;
        const tipo = codigo === 'SQLITE_CONSTRAINT_UNIQUE' ? 'unicidad' : 'integridad';
        const cid = conflicto(tipo, t, id, origen, fila, null, (e as Error).message, ahora);
        stMarcarRecibido.run(t.nombre, id, version, origen, tipo, null);
        return { estado: tipo, conflicto_id: cid };
      }
      const guardada = sinProyectadas(t, leerFila(t, id)!);
      resultado = { estado: 'aplicado', seq: registrarCambio(t, id, version, origen, updated_at, guardada, ahora) };
    }
    stMarcarRecibido.run(t.nombre, id, version, origen, resultado.estado, resultado.seq ?? null);
    return resultado;
  }

  function ultimoCursor(): number {
    return (sqlite.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM hub_cambio').get() as { s: number }).s;
  }

  return {
    aplicarLote(origen, cambios, ahora = Math.floor(Date.now() / 1000)) {
      // Se valida todo antes de tocar nada: un lote con una tabla o columna desconocida no entra.
      for (const c of cambios) normalizar(c);
      try {
        return sqlite.transaction(() => {
          sqlite.pragma('defer_foreign_keys = ON');
          return cambios.map((c) => aplicarUno(origen, c, ahora));
        })();
      } catch (e) {
        if (codigoSqlite(e) === 'SQLITE_CONSTRAINT_FOREIGNKEY') throw new Error('LOTE_FK_ROTA');
        throw e;
      }
    },

    cambiosDesde(cursor, limite) {
      const filas = sqlite.prepare(
        'SELECT seq, tabla, fila_id, version, origin_id, updated_at, fila FROM hub_cambio WHERE seq > ? ORDER BY seq LIMIT ?',
      ).all(cursor, limite + 1) as (Omit<CambioRegistrado, 'fila'> & { fila: string })[];
      const hayMas = filas.length > limite;
      const cambios = filas.slice(0, limite).map((f) => ({ ...f, fila: JSON.parse(f.fila) as Record<string, unknown> }));
      return { cambios, hasta: cambios.length ? cambios[cambios.length - 1]!.seq : cursor, hayMas };
    },

    snapshot() {
      // En una transacción: el cursor y las filas son de un mismo instante.
      return sqlite.transaction(() => ({
        cursor: ultimoCursor(),
        tablas: [...tablas.keys()].sort().map((n) => {
          const t = tablas.get(n)!;
          const filas = sqlite.prepare(`SELECT ${t.datos.map(q).join(', ')} FROM ${q(n)} ORDER BY "id"`).all() as Record<string, unknown>[];
          return { tabla: n, filas };
        }),
      }))();
    },

    conflictos() {
      return sqlite.prepare('SELECT * FROM hub_conflicto ORDER BY id').all() as ConflictoHub[];
    },

    ultimoCursor,
  };
}

/** better-sqlite3 no acepta booleanos: van como 0/1, igual que en la terminal. */
function aSqlite(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

function sonIguales(a: unknown, b: unknown): boolean {
  return aSqlite(a) === aSqlite(b) || (a == null && b == null);
}
