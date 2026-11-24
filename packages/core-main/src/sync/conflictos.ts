// Conflictos y cajas del hub, vistos desde una caja (F3 PR1, ADR-159). El hub no tiene interfaz propia:
// quien tenga `sync.conflictos` los revisa desde cualquier caja emparejada. «Recuperar» vuelve a escribir
// en esta caja la versión que perdió el last-write-wins, como un cambio nuevo que sube en el próximo push.
import type * as BetterSqlite3 from 'better-sqlite3';
import { RUTAS, type ConflictoHub, type ResolucionConflicto, type TerminalHub } from '@core/hub';
import { getOriginId } from '../context';
import { cuerpo, type TablaCliente } from './cliente';
import type { TransporteHub } from './transporte';

export interface ConflictoVista extends Omit<ConflictoHub, 'fila_entrante' | 'fila_actual'> {
  readonly fila_entrante: Record<string, unknown>;
  readonly fila_actual: Record<string, unknown> | null;
  /**
   * Cuál de las dos versiones se perdió en un `lww`: la entrante, salvo cuando el cambio concurrente que
   * llegó después ganó (`GANO_EL_ENTRANTE`) y se perdió la que estaba en el hub.
   */
  readonly perdida: 'entrante' | 'actual' | null;
  /** ¿Se puede volver a escribir la versión perdida en esta caja? (`lww` de una tabla que esta versión conoce). */
  readonly recuperable: boolean;
  /**
   * Columnas del índice único con el que chocó una alta (`unicidad`), sacadas del error del hub. Vacío si no
   * se pudieron leer: entonces la alta no se puede descartar desde acá, solo corregir a mano.
   */
  readonly columnasUnicas: readonly string[];
}

export interface FiltroConflictosTerminal {
  readonly pendientes?: boolean;
  readonly tipo?: ConflictoHub['tipo'];
  readonly antesDeId?: number;
  readonly limite?: number;
}

export interface PaginaConflictosTerminal {
  readonly conflictos: ConflictoVista[];
  readonly hayMas: boolean;
  readonly enEspera: number;
}

export interface ConflictosTerminal {
  listar(f: FiltroConflictosTerminal): Promise<PaginaConflictosTerminal>;
  resolver(id: number, resolucion: ResolucionConflicto, por: string): Promise<ConflictoVista>;
  /**
   * F3 PR2: descarta en esta caja una alta que el hub rechazó por unicidad: la da de baja lógica y libera su
   * valor único (texto con «(descartado …)» o null si la columna lo admite). El cambio sube en el próximo push,
   * entra en el hub y el conflicto queda resuelto solo (`corregido`).
   */
  descartarAlta(id: number): Promise<void>;
  terminales(): Promise<TerminalHub[]>;
}

/** Columnas que «Recuperar» no copia: las pone de nuevo esta caja (identidad y campos de sync). */
const NO_SE_RECUPERAN = new Set(['id', 'version', 'origin_id', 'sync_state', 'updated_at']);
const segundos = () => Math.floor(Date.now() / 1000);
const q = (n: string) => `"${n}"`;

/** `UNIQUE constraint failed: marca.nombre, marca.x` → ['nombre', 'x'] (solo las de esa tabla). */
export function columnasDelChoque(tabla: string, detalle: string | null): string[] {
  const m = /UNIQUE constraint failed: (.+)$/.exec(detalle ?? '');
  if (!m) return [];
  return m[1]!.split(',').map((x) => x.trim()).filter((x) => x.startsWith(`${tabla}.`)).map((x) => x.slice(tabla.length + 1));
}

function parsear(texto: string | null): Record<string, unknown> | null {
  if (texto == null) return null;
  try { return JSON.parse(texto) as Record<string, unknown>; } catch { return null; }
}

export function crearConflictosTerminal(
  sqlite: BetterSqlite3.Database,
  transporte: TransporteHub,
  tablas: ReadonlyMap<string, TablaCliente>,
): ConflictosTerminal {
  async function pedir(metodo: 'GET' | 'POST', ruta: string, datos?: unknown): Promise<Record<string, unknown>> {
    return cuerpo(await transporte.pedir(metodo, ruta, datos));
  }

  function vista(c: ConflictoHub): ConflictoVista {
    const fila_entrante = parsear(c.fila_entrante) ?? {};
    const fila_actual = parsear(c.fila_actual);
    const perdida = c.tipo !== 'lww' ? null : c.detalle === 'GANO_EL_ENTRANTE' ? 'actual' : 'entrante';
    const t = tablas.get(c.tabla);
    const filaPerdida = perdida === 'actual' ? fila_actual : perdida === 'entrante' ? fila_entrante : null;
    const recuperable = c.tipo === 'lww' && t?.tipo === 'maestro' && filaPerdida != null
      && Object.keys(filaPerdida).every((k) => t.datos.has(k));
    const columnasUnicas = c.tipo === 'unicidad' ? columnasDelChoque(c.tabla, c.detalle).filter((k) => t?.datos.has(k)) : [];
    return { ...c, fila_entrante, fila_actual, perdida, recuperable, columnasUnicas };
  }

  async function listar(f: FiltroConflictosTerminal, id?: number): Promise<PaginaConflictosTerminal> {
    const p = new URLSearchParams();
    if (f.pendientes) p.set('pendientes', '1');
    if (f.tipo) p.set('tipo', f.tipo);
    if (f.antesDeId != null) p.set('antes', String(f.antesDeId));
    if (f.limite != null) p.set('limite', String(f.limite));
    if (id != null) p.set('id', String(id));
    const r = await pedir('GET', `${RUTAS.conflictos}?${p.toString()}`);
    return {
      conflictos: ((r['conflictos'] ?? []) as ConflictoHub[]).map(vista),
      hayMas: r['hayMas'] === true,
      enEspera: Number(r['enEspera'] ?? 0),
    };
  }

  /** Escribe la versión perdida sobre la fila de esta caja; el trigger de captura la encola. */
  function recuperar(c: ConflictoVista): void {
    if (!c.recuperable) throw new Error('CONFLICTO_NO_RECUPERABLE');
    const t = tablas.get(c.tabla)!;
    const perdida = (c.perdida === 'actual' ? c.fila_actual : c.fila_entrante)!;
    const local = sqlite.prepare(`SELECT "updated_at" FROM ${q(t.nombre)} WHERE "id" = ?`).get(c.fila_id) as { updated_at: number } | undefined;
    if (!local) throw new Error('CONFLICTO_FILA_INEXISTENTE');
    const cols = Object.keys(perdida).filter((k) => !NO_SE_RECUPERAN.has(k)).sort();
    // Gana el last-write-wins en el hub: su hora es la de ahora, y nunca anterior a la que tiene la fila.
    const hora = Math.max(segundos(), Number(local.updated_at) + 1);
    const set = [...cols.map((k) => `${q(k)} = ?`), '"updated_at" = ?', '"origin_id" = ?'].join(', ');
    sqlite.prepare(`UPDATE ${q(t.nombre)} SET ${set} WHERE "id" = ?`)
      .run(...cols.map((k) => aSqlite(perdida[k])), hora, getOriginId(), c.fila_id);
  }

  async function uno(id: number): Promise<ConflictoVista> {
    const [c] = (await listar({}, id)).conflictos;
    if (!c) throw new Error('CONFLICTO_INEXISTENTE');
    if (c.resuelto) throw new Error('CONFLICTO_YA_RESUELTO');
    return c;
  }

  function descartar(c: ConflictoVista): void {
    if (c.tipo !== 'unicidad' || c.columnasUnicas.length === 0) throw new Error('CONFLICTO_NO_DESCARTABLE');
    // La fila rechazada está solo en la caja que la dio de alta: se descarta ahí.
    if (c.origin_id !== getOriginId()) throw new Error('CONFLICTO_DE_OTRA_CAJA');
    const t = tablas.get(c.tabla)!;
    const local = sqlite.prepare(`SELECT * FROM ${q(t.nombre)} WHERE "id" = ?`).get(c.fila_id) as Record<string, unknown> | undefined;
    if (!local) throw new Error('CONFLICTO_FILA_INEXISTENTE');
    const info = new Map((sqlite.prepare(`PRAGMA table_info(${q(t.nombre)})`).all() as { name: string; notnull: number }[]).map((x) => [x.name, x.notnull === 1]));
    const set: string[] = [];
    const valores: unknown[] = [];
    for (const col of c.columnasUnicas) {
      set.push(`${q(col)} = ?`);
      // Una columna que admite null (un GTIN) queda vacía; una obligatoria (un nombre) lleva la marca.
      valores.push(info.get(col) ? `${String(local[col] ?? '')} (descartado ${c.fila_id.slice(0, 8)})` : null);
    }
    if (info.has('activo')) set.push('"activo" = 0');
    if (info.has('updated_at')) { set.push('"updated_at" = ?'); valores.push(Math.max(segundos(), Number(local['updated_at'] ?? 0) + 1)); }
    sqlite.prepare(`UPDATE ${q(t.nombre)} SET ${set.join(', ')} WHERE "id" = ?`).run(...valores, c.fila_id);
  }

  return {
    listar: (f) => listar(f),
    async descartarAlta(id) {
      descartar(await uno(id));
    },
    async resolver(id, resolucion, por) {
      if (resolucion === 'recuperado') recuperar(await uno(id));
      const r = await pedir('POST', RUTAS.resolverConflicto, { id, resolucion, por });
      return vista(r['conflicto'] as ConflictoHub);
    },
    async terminales() {
      const r = await pedir('GET', RUTAS.terminales);
      return (r['terminales'] ?? []) as TerminalHub[];
    },
  };
}

/** better-sqlite3 no acepta booleanos: van como 0/1. */
function aSqlite(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}
