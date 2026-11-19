// Cliente de sync de la terminal (ADR-150 §4, §6 y §9; ADR-151 §2). Sube la cola `sync_outbox` al hub
// y baja lo que el hub ya resolvió. Genérico: no conoce ninguna tabla de ninguna app; arma el SQL desde
// el esquema compuesto y el registro de sync, como los triggers de captura y el almacén del hub.
import type * as BetterSqlite3 from 'better-sqlite3';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { aplicandoCambiosRecibidos, type RegistroSync } from '@core/db';
import { RUTAS, type CambioRegistrado, type ResultadoCambio, type Versiones } from '@core/hub';
import { recalcularSaldoCuentaCorriente } from '../ctacte-proyeccion';
import type { RespuestaHub, TransporteHub } from './transporte';

/** Una fila que bajó del hub y se escribió en la base local. `nueva` = no existía. */
export interface CambioAplicado {
  readonly tabla: string;
  readonly fila: Readonly<Record<string, unknown>>;
  readonly nueva: boolean;
}

type DbProyecciones = Parameters<typeof recalcularSaldoCuentaCorriente>[0];
/** La base de la terminal: Drizzle (para las proyecciones) sobre la conexión de better-sqlite3. */
export type DbSync = DbProyecciones & { readonly $client: BetterSqlite3.Database };

export interface OpcionesClienteSync {
  readonly schema: Record<string, unknown>;
  readonly registro: RegistroSync;
  readonly transporte: TransporteHub;
  /**
   * Proyecciones de la app (ADR-151): recalcula el stock y el costo de lo que tocaron los libros
   * recibidos. Corre dentro de la transacción de la página. La cuenta corriente la recalcula el núcleo.
   */
  readonly alAplicar?: (aplicados: readonly CambioAplicado[]) => void;
  readonly tamLote?: number;
  readonly tamPagina?: number;
  /** Desfasaje del reloj contra el hub a partir del cual se avisa (ADR-150 §9). */
  readonly umbralDesfasajeMs?: number;
  readonly avisarDesfasaje?: (desfasajeMs: number) => void;
}

export interface EstadoSync {
  /** null = todavía no se intentó. */
  readonly enLinea: boolean | null;
  readonly ultimoError: string | null;
  readonly ultimoPushMs: number | null;
  readonly ultimoPullMs: number | null;
  readonly pendientes: number;
  readonly cursor: number;
  readonly desfasajeMs: number | null;
  readonly relojDesfasado: boolean;
  /** Las versiones del hub cuando rechazó las de esta terminal (ADR-150 §8). */
  readonly versionesHub: Versiones | null;
}

export interface ResultadoPush { readonly enviados: number; readonly conflictos: number }
export interface ResultadoPull { readonly recibidos: number; readonly aplicados: number }

export interface ClienteSync {
  push(): Promise<ResultadoPush>;
  pull(): Promise<ResultadoPull>;
  /** Push y después pull: lo local sube antes de bajar lo resuelto. */
  sincronizar(): Promise<{ push: ResultadoPush; pull: ResultadoPull }>;
  /** Push solo si hay cambios pendientes (la tarea frecuente que agrupa los de unos segundos). */
  pushSiHayPendientes(): Promise<ResultadoPush>;
  estado(): EstadoSync;
}

export const CLAVE_CURSOR = 'sync_cursor_hub';
export const CLAVE_DESFASAJE = 'sync_desfasaje_ms';
const TAM_LOTE = 200;
const TAM_PAGINA = 500;
const MAX_PAGINAS_POR_PULL = 100;
const UMBRAL_DESFASAJE_MS = 60_000;
/** Lo ya enviado se conserva unos días para diagnóstico y después se purga. */
const RETENCION_ENVIADOS_S = 7 * 24 * 3600;

export interface TablaCliente {
  readonly nombre: string;
  readonly tipo: 'maestro' | 'libro';
  readonly datos: ReadonlySet<string>;
  readonly proyectadasSinDefault: readonly string[];
}

const q = (n: string) => `"${n}"`;
const segundos = () => Math.floor(Date.now() / 1000);

/** Tablas que sincronizan, con las columnas que viajan (también lo usa el arranque). */
export function tablasDelCliente(schema: Record<string, unknown>, registro: RegistroSync): Map<string, TablaCliente> {
  const out = new Map<string, TablaCliente>();
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    const entrada = registro[cfg.name];
    if (entrada?.tipo !== 'maestro' && entrada?.tipo !== 'libro') continue;
    const proyectadas = new Set(entrada.proyectadas ?? []);
    out.set(cfg.name, {
      nombre: cfg.name,
      tipo: entrada.tipo,
      datos: new Set(cfg.columns.map((c) => c.name).filter((c) => !proyectadas.has(c))),
      proyectadasSinDefault: cfg.columns.filter((c) => proyectadas.has(c.name) && c.notNull && !c.hasDefault).map((c) => c.name),
    });
  }
  return out;
}

/** Traduce la respuesta del hub: 200 devuelve el cuerpo; el resto, un error con código. */
export function cuerpo(r: RespuestaHub): Record<string, unknown> {
  if (r.status === 200) return r.body;
  const detalle = typeof r.body['error'] === 'string' ? r.body['error'] : '';
  if (r.status === 401) throw new Error('HUB_NO_AUTORIZADO');
  if (r.status === 409) throw Object.assign(new Error('VERSION_INCOMPATIBLE'), { versiones: r.body['versiones'] });
  // Un rechazo del pedido con código del hub (código de emparejamiento, lote inválido, demasiados
  // intentos) se propaga con ese código, para que la pantalla lo traduzca.
  if ((r.status === 422 || r.status === 429) && /^[A-Z_]+/.test(detalle)) throw new Error(detalle);
  throw new Error(`HUB_ERROR: ${r.status} ${detalle}`.trim());
}

/** Errores de red: la terminal sigue operando y la cola crece (ADR-150 §9). No son fallas del código. */
export function esErrorDeConexion(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return m.startsWith('HUB_INALCANZABLE') || m.startsWith('TIEMPO_AGOTADO');
}

export function crearClienteSync(db: DbSync, o: OpcionesClienteSync): ClienteSync {
  const sqlite = db.$client;
  const tablas = tablasDelCliente(o.schema, o.registro);
  const tamLote = o.tamLote ?? TAM_LOTE;
  const tamPagina = o.tamPagina ?? TAM_PAGINA;
  const umbral = o.umbralDesfasajeMs ?? UMBRAL_DESFASAJE_MS;

  const sentencias = new Map<string, BetterSqlite3.Statement>();
  const preparar = (sql: string) => {
    let s = sentencias.get(sql);
    if (!s) { s = sqlite.prepare(sql); sentencias.set(sql, s); }
    return s;
  };

  let enLinea: boolean | null = null;
  let ultimoError: string | null = null;
  let ultimoPushMs: number | null = null;
  let ultimoPullMs: number | null = null;
  let desfasajeMs: number | null = null;
  let versionesHub: Versiones | null = null;
  // Push y pull nunca se pisan: cada operación espera a la anterior.
  let cola: Promise<unknown> = Promise.resolve();

  function leerParametro(clave: string): string | undefined {
    return (preparar('SELECT "valor" FROM "parametros_sistema" WHERE "clave" = ?').get(clave) as { valor: string } | undefined)?.valor;
  }
  function escribirParametro(clave: string, valor: string, descripcion: string): void {
    preparar(
      'INSERT INTO "parametros_sistema" ("clave", "valor", "tipo", "descripcion", "actualizado_en") VALUES (?, ?, \'number\', ?, ?) ' +
      'ON CONFLICT ("clave") DO UPDATE SET "valor" = excluded."valor", "actualizado_en" = excluded."actualizado_en"',
    ).run(clave, valor, descripcion, segundos());
  }
  const leerCursor = () => Number(leerParametro(CLAVE_CURSOR) ?? 0);
  if (leerParametro(CLAVE_DESFASAJE) !== undefined) desfasajeMs = Number(leerParametro(CLAVE_DESFASAJE));

  /** Cada respuesta trae la hora del hub: el desfasaje es contra el punto medio del viaje. */
  function medirReloj(r: RespuestaHub): void {
    const hora = r.body['hora_hub_ms'];
    if (typeof hora !== 'number') return;
    desfasajeMs = Math.round(hora - (r.enviadoMs + r.recibidoMs) / 2);
    escribirParametro(CLAVE_DESFASAJE, String(desfasajeMs), 'Desfasaje del reloj de la terminal contra el hub, en ms (ADR-150 §9).');
    if (Math.abs(desfasajeMs) > umbral) o.avisarDesfasaje?.(desfasajeMs);
  }

  async function pedir(metodo: 'GET' | 'POST', ruta: string, datos?: unknown): Promise<Record<string, unknown>> {
    let r: RespuestaHub;
    try {
      r = await o.transporte.pedir(metodo, ruta, datos);
    } catch (e) {
      enLinea = false;
      ultimoError = e instanceof Error ? e.message : String(e);
      throw e;
    }
    enLinea = true;
    medirReloj(r);
    try {
      const b = cuerpo(r);
      versionesHub = null;
      return b;
    } catch (e) {
      ultimoError = (e as Error).message;
      if (ultimoError === 'VERSION_INCOMPATIBLE') versionesHub = (e as { versiones?: Versiones }).versiones ?? null;
      throw e;
    }
  }

  function enSerie<T>(fn: () => Promise<T>): Promise<T> {
    const p = cola.then(fn, fn);
    cola = p.then(() => undefined, () => undefined);
    return p;
  }

  // ── Push ────────────────────────────────────────────────────────────────────────────────────────
  interface EntradaOutbox { seq: number; tabla: string; fila_id: string; fila: string }

  const ESTADO_FILA: Record<ResultadoCambio['estado'], 'synced' | 'conflict'> = {
    aplicado: 'synced',
    // Perdió el last-write-wins: el ganador baja en el pull y pisa la fila.
    perdio: 'synced',
    unicidad: 'conflict',
    integridad: 'conflict',
  };

  async function pushInterno(): Promise<ResultadoPush> {
    let enviados = 0;
    let conflictos = 0;
    for (;;) {
      const lote = preparar(
        'SELECT "seq", "tabla", "fila_id", "fila" FROM "sync_outbox" WHERE "enviado_en" IS NULL ORDER BY "seq" LIMIT ?',
      ).all(tamLote) as EntradaOutbox[];
      if (lote.length === 0) break;
      const r = await pedir('POST', RUTAS.push, { cambios: lote.map((e) => ({ tabla: e.tabla, fila: JSON.parse(e.fila) as unknown })) });
      const resultados = r['resultados'];
      if (!Array.isArray(resultados) || resultados.length !== lote.length) throw new Error('HUB_RESPUESTA_INVALIDA: push');
      sqlite.transaction(() => {
        const ahora = segundos();
        lote.forEach((e, i) => {
          const res = resultados[i] as ResultadoCambio;
          preparar('UPDATE "sync_outbox" SET "enviado_en" = ? WHERE "seq" = ?').run(ahora, e.seq);
          if (res.estado !== 'aplicado' && res.estado !== 'perdio') conflictos++;
          const t = tablas.get(e.tabla);
          if (!t) return;
          // Si la fila cambió otra vez desde que se armó el lote, sigue pendiente hasta el próximo push.
          const posterior = preparar(
            'SELECT 1 FROM "sync_outbox" WHERE "tabla" = ? AND "fila_id" = ? AND "enviado_en" IS NULL AND "seq" > ? LIMIT 1',
          ).get(e.tabla, e.fila_id, e.seq);
          if (!posterior) {
            // Solo cambia sync_state: los triggers de captura no lo cuentan como cambio y no encolan.
            preparar(`UPDATE ${q(t.nombre)} SET "sync_state" = ? WHERE "id" = ?`).run(ESTADO_FILA[res.estado] ?? 'conflict', e.fila_id);
          }
        });
        preparar('DELETE FROM "sync_outbox" WHERE "enviado_en" IS NOT NULL AND "enviado_en" < ?').run(ahora - RETENCION_ENVIADOS_S);
      })();
      enviados += lote.length;
      if (lote.length < tamLote) break;
    }
    ultimoPushMs = Date.now();
    ultimoError = null;
    return { enviados, conflictos };
  }

  // ── Pull ────────────────────────────────────────────────────────────────────────────────────────
  function pendienteLocal(tabla: string, filaId: string): boolean {
    return preparar('SELECT 1 FROM "sync_outbox" WHERE "tabla" = ? AND "fila_id" = ? AND "enviado_en" IS NULL LIMIT 1').get(tabla, filaId) !== undefined;
  }

  /** Escribe una fila recibida pisando por `id` (el hub ya resolvió). Devuelve null si no la escribió. */
  function aplicarCambio(c: CambioRegistrado): CambioAplicado | null {
    const t = tablas.get(c.tabla);
    // Una tabla que esta versión no conoce (hub una versión adelante, ADR-150 §8) se ignora.
    if (!t) return null;
    // Un cambio local sin subir es más nuevo que lo que baja: sube en el próximo push y el hub resuelve.
    if (pendienteLocal(t.nombre, c.fila_id)) return null;
    const existe = preparar(`SELECT 1 FROM ${q(t.nombre)} WHERE "id" = ?`).get(c.fila_id) !== undefined;
    if (existe && t.tipo === 'libro') return null; // los movimientos no cambian: ya está
    // Columnas que esta versión no conoce (hub más nuevo) no se escriben.
    const cols = Object.keys(c.fila).filter((k) => t.datos.has(k) && k !== 'sync_state' && k !== 'id').sort();
    const valores = cols.map((k) => c.fila[k] as unknown);
    if (existe) {
      const set = [...cols.map((k) => `${q(k)} = ?`), '"sync_state" = \'synced\''].join(', ');
      preparar(`UPDATE ${q(t.nombre)} SET ${set} WHERE "id" = ?`).run(...valores, c.fila_id);
    } else {
      const extra = t.proyectadasSinDefault.filter((k) => !cols.includes(k));
      const todas = ['id', ...cols, ...extra, 'sync_state'];
      const marcas = todas.map((k) => (k === 'sync_state' ? '\'synced\'' : '?')).join(', ');
      preparar(`INSERT INTO ${q(t.nombre)} (${todas.map(q).join(', ')}) VALUES (${marcas})`)
        .run(c.fila_id, ...valores, ...extra.map(() => 0));
    }
    return { tabla: t.nombre, fila: c.fila, nueva: !existe };
  }

  /** Proyecciones del núcleo (ADR-151): el saldo de las cuentas corrientes tocadas por su libro. */
  function recalcularNucleo(aplicados: readonly CambioAplicado[]): void {
    const cuentas = new Set<string>();
    for (const a of aplicados) {
      if (a.tabla === 'movimiento_cuenta_corriente') cuentas.add(String(a.fila['cuenta_id']));
      if (a.tabla === 'cuenta_corriente_cliente' && a.nueva) cuentas.add(String(a.fila['id']));
    }
    for (const id of cuentas) recalcularSaldoCuentaCorriente(db, id);
  }

  async function pullInterno(): Promise<ResultadoPull> {
    let cursor = leerCursor();
    let recibidos = 0;
    let aplicadosTotal = 0;
    for (let pagina = 0; pagina < MAX_PAGINAS_POR_PULL; pagina++) {
      const r = await pedir('GET', `${RUTAS.pull}?desde=${cursor}&limite=${tamPagina}`);
      const cambios = r['cambios'] as CambioRegistrado[] | undefined;
      const hasta = r['hasta'];
      if (!Array.isArray(cambios) || typeof hasta !== 'number') throw new Error('HUB_RESPUESTA_INVALIDA: pull');
      try {
        aplicandoCambiosRecibidos(sqlite, () => {
          // El orden del hub respeta el de cada terminal, pero una página puede traer el hijo antes
          // que el padre (reemisiones): las FK se verifican al cerrar la página.
          sqlite.pragma('defer_foreign_keys = ON');
          const aplicados: CambioAplicado[] = [];
          for (const c of cambios) {
            const a = aplicarCambio(c);
            if (a) aplicados.push(a);
          }
          recalcularNucleo(aplicados);
          if (aplicados.length) o.alAplicar?.(aplicados);
          escribirParametro(CLAVE_CURSOR, String(hasta), 'Último cambio del hub aplicado en esta terminal (ADR-150 §4).');
          aplicadosTotal += aplicados.length;
        });
      } catch (e) {
        const codigo = (e as { code?: string }).code ?? '';
        if (codigo.startsWith('SQLITE_CONSTRAINT_FOREIGNKEY')) throw new Error('PULL_FK_ROTA');
        throw e;
      }
      recibidos += cambios.length;
      cursor = hasta;
      if (r['hayMas'] !== true) break;
    }
    ultimoPullMs = Date.now();
    ultimoError = null;
    return { recibidos, aplicados: aplicadosTotal };
  }

  function pendientes(): number {
    return (preparar('SELECT count(*) AS n FROM "sync_outbox" WHERE "enviado_en" IS NULL').get() as { n: number }).n;
  }

  return {
    push: () => enSerie(pushInterno),
    pull: () => enSerie(pullInterno),
    sincronizar: () => enSerie(async () => ({ push: await pushInterno(), pull: await pullInterno() })),
    pushSiHayPendientes: () => enSerie(async () => (pendientes() > 0 ? pushInterno() : { enviados: 0, conflictos: 0 })),
    estado: () => ({
      enLinea,
      ultimoError,
      ultimoPushMs,
      ultimoPullMs,
      pendientes: pendientes(),
      cursor: leerCursor(),
      desfasajeMs,
      relojDesfasado: desfasajeMs !== null && Math.abs(desfasajeMs) > umbral,
      versionesHub,
    }),
  };
}
