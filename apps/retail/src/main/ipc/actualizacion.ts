import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { obtenerEstado, instalarYReiniciar, type EstadoActualizacion } from '../actualizacion/estado';
import { obtenerNotas } from '../actualizacion/changelog';

type Db = BetterSQLite3Database<typeof schema>;
interface AppLike { getVersion: () => string }

const CLAVE_VERSION_VISTA = 'app_version_vista';

function requireSession() {
  const s = getSession();
  if (!s) throw new Error('FORBIDDEN');
  return s;
}

export function estadoHandler(): EstadoActualizacion {
  requireSession();
  return obtenerEstado();
}

export function instalarYReiniciarHandler(): void {
  requireSession();
  instalarYReiniciar();
}

export interface NotasPostUpdate { version: string; titulo: string; notas: string[] }

export function notasPostUpdateHandler(db: Db, app: AppLike): NotasPostUpdate | null {
  requireSession();
  const actual = app.getVersion();
  const row = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, CLAVE_VERSION_VISTA))
    .get();
  if ((row?.valor ?? null) === actual) return null;
  const notas = obtenerNotas(actual);
  if (!notas) return null;
  return { version: actual, titulo: notas.titulo, notas: notas.notas };
}

export function marcarVersionVistaHandler(db: Db, app: AppLike): void {
  const session = requireSession();
  const actual = app.getVersion();
  const now = new Date();
  db.insert(schema.parametros_sistema)
    .values({
      clave: CLAVE_VERSION_VISTA,
      valor: actual,
      tipo: 'string',
      descripcion: 'Última versión cuyas novedades vio el usuario en esta terminal',
      actualizado_en: now,
      actualizado_por: session.userId,
    })
    .onConflictDoUpdate({
      target: schema.parametros_sistema.clave,
      set: { valor: actual, actualizado_en: now, actualizado_por: session.userId },
    })
    .run();
}

export function registerActualizacionHandlers(ipcMain: IpcMain, db: Db, app: AppLike): void {
  ipcMain.handle('actualizacion:estado',             async () => estadoHandler());
  ipcMain.handle('actualizacion:instalarYReiniciar', async () => instalarYReiniciarHandler());
  ipcMain.handle('actualizacion:notasPostUpdate',    async () => notasPostUpdateHandler(db, app));
  ipcMain.handle('actualizacion:marcarVersionVista', async () => marcarVersionVistaHandler(db, app));
}
