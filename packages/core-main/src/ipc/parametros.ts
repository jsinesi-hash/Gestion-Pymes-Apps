import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getCachedParametro, setCachedParametro, invalidateCachedParametro } from './parametros-cache';

type Db = BetterSQLite3Database<typeof schema>;

function requireSupervisor() {
  const session = getSession();
  if (!session) throw new Error('FORBIDDEN');
  if (!session.permisos.has('config.fiscal')) throw new Error('FORBIDDEN');
  return session;
}

export function parametrosGetHandler(db: Db, payload: { clave: string }): string | null {
  const cached = getCachedParametro(payload.clave);
  if (cached.loaded) return cached.value;
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, payload.clave))
    .get();
  const valor = row?.valor ?? null;
  setCachedParametro(payload.clave, valor);
  return valor;
}

export function parametrosSetHandler(db: Db, payload: { clave: string; valor: string }): void {
  const session = requireSupervisor();
  const now = new Date();
  db.update(schema.parametros_sistema)
    .set({ valor: payload.valor, actualizado_en: now, actualizado_por: session.userId })
    .where(eq(schema.parametros_sistema.clave, payload.clave))
    .run();
  invalidateCachedParametro(payload.clave);
}

export type FeatureFlagInfo = { clave: string; valor: string; descripcion: string | null };

// Las descripciones de los flags vienen sembradas por migraciones y arrastran referencias
// internas de construcción (ADR-xxx, SEC-x, PERF-x). La pantalla de Funcionalidades es de
// cara al usuario, así que las limpiamos en lectura — sin tocar la historia de migraciones.
export function limpiarReferenciasInternas(desc: string | null): string | null {
  if (!desc) return desc;
  let s = desc;
  // Prefijo tipo "ADR-067: texto".
  s = s.replace(/^\s*(?:ADR|SEC|PERF)-\d+[a-z]?:\s*/i, '');
  // Tokens internos dentro de paréntesis: si el paréntesis queda vacío, se elimina entero;
  // si tenía más texto (p. ej. "token-set / ADR-063"), se conserva ese texto.
  s = s.replace(/\(([^)]*)\)/g, (_full, inner: string) => {
    const limpio = inner
      .replace(/(?:ADR|SEC|PERF)-\d+[a-z]?(?:\/\d+[a-z]?)*/gi, '')
      .replace(/^\s*[/,]\s*/, '')
      .replace(/\s*[/,]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return limpio ? `(${limpio})` : '';
  });
  // Tokens internos sueltos fuera de paréntesis.
  s = s.replace(/(?:ADR|SEC|PERF)-\d+[a-z]?(?:\/\d+[a-z]?)*/gi, '');
  // Limpieza final: espacios antes de puntuación, paréntesis vacíos, espacios dobles.
  s = s.replace(/\s+([.,;])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

export function parametrosListFlagsHandler(db: Db): FeatureFlagInfo[] {
  requireSupervisor();
  const rows = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.tipo, 'bool'))
    .all();
  return rows
    .filter(r => r.clave.endsWith('_habilitado'))
    .map(r => ({ clave: r.clave, valor: r.valor, descripcion: limpiarReferenciasInternas(r.descripcion ?? null) }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
}

export function registerParametrosHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('parametros:get', async (_e, p) => parametrosGetHandler(db, p));
  ipcMain.handle('parametros:set', async (_e, p) => parametrosSetHandler(db, p));
  ipcMain.handle('parametros:listFlags', async () => parametrosListFlagsHandler(db));
}
