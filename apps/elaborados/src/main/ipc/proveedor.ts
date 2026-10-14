import { eq, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getSession, getOriginId, requirePermission, str } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export function proveedorListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.proveedor)
    .where(eq(schema.proveedor.activo, true)).orderBy(asc(schema.proveedor.razon_social)).all();
}

/**
 * Alta rápida desde la pantalla de compras (ADR-103): solo razón social. Los datos obligatorios
 * del core (documento y condición fiscal) llevan defaults hasta que exista el CRUD completo de
 * proveedores (E4-PR5).
 */
export function proveedorCrearRapidoHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const razon_social = str(p['razon_social'], 'razon_social', { max: 120 });
  const now = new Date();
  const id = generateId();
  db.insert(schema.proveedor).values({
    id, tipo_documento: 'DNI', numero_documento: '0', razon_social, condicion_fiscal: 'Consumidor Final',
    activo: true, usuario_creacion_id: session.userId, fecha_creacion: now,
    version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
  }).run();
  return db.select().from(schema.proveedor).where(eq(schema.proveedor.id, id)).get()!;
}

export function registerProveedorHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('compra.registrar');
  ipcMain.handle('proveedor:list', async () => proveedorListHandler(db));
  ipcMain.handle('proveedor:crear-rapido', guard(async (_e, p) => proveedorCrearRapidoHandler(db, p)));
}
