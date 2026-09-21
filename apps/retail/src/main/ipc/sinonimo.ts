import { eq, and } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { normalizarTermino } from '../sinonimos/normalizar';
import { parsearCsvSinonimos } from '../sinonimos/csv';
import { validarSinonimos, type ProblemaSinonimo } from '../sinonimos/validar';
import { str, optStr, id, arr } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-067 — ABM de sinónimos (Configuración → Sinónimos). Trabaja a nivel GRUPO: un grupo
// es el conjunto de filas de `sinonimo` que comparten `grupo_id`. Sólo Supervisor.
function requireAdmin() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  return session;
}

export type SinonimoGrupoDTO = {
  grupo_id: string;
  canonico: string;
  sinonimos: string[];
  abreviaturas: string[];
  rubro: string | null;
  nota: string | null;
  origen: 'seed' | 'manual' | 'import';
  total_terminos: number;
};

export type SinonimoGrupoPayload = {
  canonico: string;
  sinonimos?: string[];
  abreviaturas?: string[];
  rubro?: string | null;
  nota?: string | null;
};

function agruparFilas(filas: (typeof schema.sinonimo.$inferSelect)[]): SinonimoGrupoDTO[] {
  const porGrupo = new Map<string, typeof filas>();
  for (const f of filas) {
    const arr = porGrupo.get(f.grupo_id) ?? [];
    arr.push(f);
    porGrupo.set(f.grupo_id, arr);
  }
  const grupos: SinonimoGrupoDTO[] = [];
  for (const [grupo_id, rows] of porGrupo) {
    const canonicoRow = rows.find(r => r.es_canonico) ?? rows[0];
    grupos.push({
      grupo_id,
      canonico: canonicoRow.termino,
      sinonimos: rows.filter(r => !r.es_canonico && !r.es_abreviatura).map(r => r.termino),
      abreviaturas: rows.filter(r => r.es_abreviatura).map(r => r.termino),
      rubro: canonicoRow.rubro,
      nota: canonicoRow.nota,
      origen: canonicoRow.origen,
      total_terminos: rows.length,
    });
  }
  grupos.sort((a, b) => a.canonico.localeCompare(b.canonico, 'es'));
  return grupos;
}

// Filas para exportación (ADR-EXP): un renglón por término de sinónimo activo.
export function sinonimoQueryAll(db: Db) {
  return db.select({
    termino: schema.sinonimo.termino,
    rubro: schema.sinonimo.rubro,
    es_canonico: schema.sinonimo.es_canonico,
    es_abreviatura: schema.sinonimo.es_abreviatura,
    activo: schema.sinonimo.activo,
  }).from(schema.sinonimo)
    .where(eq(schema.sinonimo.activo, true))
    .orderBy(schema.sinonimo.rubro, schema.sinonimo.termino)
    .all();
}

export function sinonimoGrupoListHandler(db: Db, payload: { busqueda?: string } = {}): SinonimoGrupoDTO[] {
  requireAdmin();
  const filas = db.select().from(schema.sinonimo)
    .where(eq(schema.sinonimo.activo, true))
    .all();
  let grupos = agruparFilas(filas);
  const q = normalizarTermino(payload.busqueda ?? '');
  if (q) {
    grupos = grupos.filter(g =>
      [g.canonico, ...g.sinonimos, ...g.abreviaturas].some(t => normalizarTermino(t).includes(q)));
  }
  return grupos;
}

// Inserta las filas de un grupo (canónico + sinónimos + abreviaturas) con dedup por norma.
function insertarTerminos(
  tx: Db, grupoId: string, payload: SinonimoGrupoPayload,
  origen: 'manual' | 'import', userId: string, now: Date,
): void {
  const originId = getOriginId();
  const terminos = [
    { termino: payload.canonico, es_canonico: true, es_abreviatura: false },
    ...(payload.sinonimos ?? []).map(s => ({ termino: s, es_canonico: false, es_abreviatura: false })),
    ...(payload.abreviaturas ?? []).map(a => ({ termino: a, es_canonico: false, es_abreviatura: true })),
  ];
  const vistos = new Set<string>();
  for (const t of terminos) {
    const termino = t.termino.trim();
    const norm = normalizarTermino(termino);
    if (!norm || vistos.has(norm)) continue;
    vistos.add(norm);
    tx.insert(schema.sinonimo).values({
      id: generateId(),
      grupo_id: grupoId,
      termino,
      termino_norm: norm,
      es_canonico: t.es_canonico,
      es_abreviatura: t.es_abreviatura,
      rubro: payload.rubro ?? null,
      nota: payload.nota ?? null,
      origen,
      activo: true,
      usuario_creacion_id: userId,
      fecha_creacion: now,
      version: 1,
      origin_id: originId,
      sync_state: 'pending',
      updated_at: now,
    }).onConflictDoNothing().run();
  }
}

// ADR-085 (SEC-2): valida los campos comunes de create/update. No valida `grupo_id`
// (cada handler lo trata por separado: create lo genera, update lo exige).
function validarGrupoPayload(p: Record<string, unknown>): SinonimoGrupoPayload {
  const v_canonico = str(p['canonico'], 'canonico', { max: 200 });
  const v_rubro = optStr(p['rubro'], 'rubro', 100);
  const v_nota = optStr(p['nota'], 'nota', 1000);
  const v_sinonimos = p['sinonimos'] == null
    ? undefined
    : arr(p['sinonimos'], 'sinonimos', (x, i) => str(x, `sinonimos.${i}`, { max: 200 }));
  const v_abreviaturas = p['abreviaturas'] == null
    ? undefined
    : arr(p['abreviaturas'], 'abreviaturas', (x, i) => str(x, `abreviaturas.${i}`, { max: 200 }));
  if (!normalizarTermino(v_canonico)) throw new Error('CANONICO_REQUERIDO');
  return {
    canonico: v_canonico,
    ...(v_sinonimos !== undefined ? { sinonimos: v_sinonimos } : {}),
    ...(v_abreviaturas !== undefined ? { abreviaturas: v_abreviaturas } : {}),
    rubro: v_rubro ?? null,
    nota: v_nota ?? null,
  };
}

export function sinonimoGrupoCreateHandler(db: Db, payload: unknown): SinonimoGrupoDTO {
  const session = requireAdmin();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_payload = validarGrupoPayload(p);
  const now = new Date();
  const grupoId = generateId();
  db.transaction((tx) => insertarTerminos(tx, grupoId, v_payload, 'manual', session.userId, now));
  return sinonimoGrupoGetHandler(db, { grupo_id: grupoId })!;
}

export function sinonimoGrupoGetHandler(db: Db, payload: { grupo_id: string }): SinonimoGrupoDTO | null {
  requireAdmin();
  const filas = db.select().from(schema.sinonimo)
    .where(and(eq(schema.sinonimo.grupo_id, payload.grupo_id), eq(schema.sinonimo.activo, true)))
    .all();
  if (filas.length === 0) return null;
  return agruparFilas(filas)[0];
}

export function sinonimoGrupoUpdateHandler(db: Db, payload: unknown): SinonimoGrupoDTO {
  const session = requireAdmin();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_grupo_id = id(p['grupo_id'], 'grupo_id');
  const v_payload = validarGrupoPayload(p);
  const existentes = db.select().from(schema.sinonimo)
    .where(eq(schema.sinonimo.grupo_id, v_grupo_id)).all();
  if (existentes.length === 0) throw new Error('NOT_FOUND');
  const origen = (existentes.find(r => r.es_canonico) ?? existentes[0]).origen;
  const now = new Date();
  db.transaction((tx) => {
    // Reemplazo total del grupo: borra sus filas y reinserta (conserva grupo_id y origen).
    tx.delete(schema.sinonimo).where(eq(schema.sinonimo.grupo_id, v_grupo_id)).run();
    insertarTerminos(tx, v_grupo_id, v_payload, origen === 'seed' ? 'manual' : origen, session.userId, now);
  });
  return sinonimoGrupoGetHandler(db, { grupo_id: v_grupo_id })!;
}

// Baja lógica del grupo entero (activo = false en todas sus filas).
export function sinonimoGrupoDeleteHandler(db: Db, payload: unknown): { eliminados: number } {
  const session = requireAdmin();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_grupo_id = id(p['grupo_id'], 'grupo_id');
  const now = new Date();
  const res = db.update(schema.sinonimo)
    .set({ activo: false, updated_at: now, sync_state: 'pending', usuario_modificacion_id: session.userId, fecha_actualizacion: now })
    .where(and(eq(schema.sinonimo.grupo_id, v_grupo_id), eq(schema.sinonimo.activo, true)))
    .run();
  return { eliminados: res.changes };
}

// ── Importación CSV (ADR-067, Fase 4) ────────────────────────────────────────
const fmtProblema = (p: ProblemaSinonimo): string =>
  (p.grupo ? `Grupo ${p.grupo}: ` : '') + p.mensaje;

export type SinonimoImportPreview = {
  grupos: number;
  errores: string[];       // formato + validación → BLOQUEAN la importación
  advertencias: string[];  // no bloquean
};

// Preview sin escribir: parsea y valida el CSV, devuelve conteos y problemas.
export function sinonimoImportarValidarHandler(db: Db, payload: { csv: string }): SinonimoImportPreview {
  requireAdmin();
  const { grupos, errores } = parsearCsvSinonimos(payload.csv ?? '');
  const val = validarSinonimos(grupos);
  return {
    grupos: grupos.length,
    errores: [...errores, ...val.errores.map(fmtProblema)],
    advertencias: val.advertencias.map(fmtProblema),
  };
}

export type SinonimoImportResult = SinonimoImportPreview & { gruposImportados: number };

// Importa el CSV. Si `reemplazar`, borra primero todo lo importado previamente
// (origen='import'); nunca toca los grupos 'seed' ni 'manual'. Si hay errores, no importa.
export function sinonimoImportarHandler(db: Db, payload: unknown): SinonimoImportResult {
  const session = requireAdmin();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_csv = str(p['csv'], 'csv');
  const v_reemplazar = p['reemplazar'] === true;
  const { grupos, errores } = parsearCsvSinonimos(v_csv);
  const val = validarSinonimos(grupos);
  const errs = [...errores, ...val.errores.map(fmtProblema)];
  const advertencias = val.advertencias.map(fmtProblema);
  if (errs.length > 0) return { grupos: grupos.length, gruposImportados: 0, errores: errs, advertencias };

  const now = new Date();
  db.transaction((tx) => {
    if (v_reemplazar) {
      tx.delete(schema.sinonimo).where(eq(schema.sinonimo.origen, 'import')).run();
    }
    for (const g of grupos) {
      insertarTerminos(tx, generateId(), g, 'import', session.userId, now);
    }
  });
  return { grupos: grupos.length, gruposImportados: grupos.length, errores: [], advertencias };
}

export function registerSinonimoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('sinonimo:list',   async (_e, p) => sinonimoGrupoListHandler(db, p));
  ipcMain.handle('sinonimo:get',    async (_e, p) => sinonimoGrupoGetHandler(db, p));
  ipcMain.handle('sinonimo:create', async (_e, p) => sinonimoGrupoCreateHandler(db, p));
  ipcMain.handle('sinonimo:update', async (_e, p) => sinonimoGrupoUpdateHandler(db, p));
  ipcMain.handle('sinonimo:delete', async (_e, p) => sinonimoGrupoDeleteHandler(db, p));
  ipcMain.handle('sinonimo:importarValidar', async (_e, p) => sinonimoImportarValidarHandler(db, p));
  ipcMain.handle('sinonimo:importar',        async (_e, p) => sinonimoImportarHandler(db, p));
}
