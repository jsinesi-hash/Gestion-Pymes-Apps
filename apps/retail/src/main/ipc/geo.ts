import { eq, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';

type Db = BetterSQLite3Database<typeof schema>;

export function geoProvinciasHandler(db: Db) {
  if (!getSession()) throw new Error('UNAUTHENTICATED');
  return db.select({ id: schema.provincia.id, nombre: schema.provincia.nombre })
    .from(schema.provincia)
    .orderBy(asc(schema.provincia.nombre))
    .all();
}

export function geoLocalidadesHandler(db: Db, provinciaId: string, _q: string) {
  if (!getSession()) throw new Error('UNAUTHENTICATED');
  return db.select({
    id:           schema.localidad.id,
    nombre:       schema.localidad.nombre,
    codigoPostal: schema.localidad.codigoPostal,
  })
    .from(schema.localidad)
    .where(eq(schema.localidad.provinciaId, provinciaId))
    .orderBy(asc(schema.localidad.nombre))
    .all();
}

export function registerGeoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('geo:provincias', async () => geoProvinciasHandler(db));
  ipcMain.handle('geo:localidades', async (_e, provinciaId: string, q = '') =>
    geoLocalidadesHandler(db, provinciaId, q)
  );
}
