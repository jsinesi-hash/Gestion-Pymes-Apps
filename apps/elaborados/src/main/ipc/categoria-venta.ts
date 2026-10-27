import { asc, eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId, requirePermission, str, int, requireSession } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function categoriaVentaListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.categoria_venta).orderBy(asc(schema.categoria_venta.orden)).all();
}

export function categoriaVentaCreateHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_nombre = str(p['nombre'], 'nombre', { max: 60 });
  const v_orden = p['orden'] == null ? 0 : int(p['orden'], 'orden', { min: 0 });

  const now = new Date();
  const id = generateId();
  db.insert(schema.categoria_venta).values({
    id, nombre: v_nombre, orden: v_orden, activo: true,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();

  return db.select().from(schema.categoria_venta).where(eq(schema.categoria_venta.id, id)).get()!;
}

export function registerCategoriaVentaHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('producto_venta.gestionar');
  ipcMain.handle('categoria-venta:list', async () => categoriaVentaListHandler(db));
  ipcMain.handle('categoria-venta:create', guard(async (_e, p) => categoriaVentaCreateHandler(db, p)));
}
