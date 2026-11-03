import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { requireSession } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

// Revisión 2026-10-20 (P2): era un archivo idéntico, byte a byte, en Retail y en Elaborados. La
// tabla `impuesto` ya vive en @core/db (ADR-093), así que el handler es universal. Exige sesión
// (sin permiso puntual: lo necesitan ambos roles) como el resto de las lecturas de catálogo.
export function impuestoListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.impuesto).where(eq(schema.impuesto.activo, true)).all();
}

export function registerImpuestoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('impuesto:list', async () => impuestoListHandler(db));
}
