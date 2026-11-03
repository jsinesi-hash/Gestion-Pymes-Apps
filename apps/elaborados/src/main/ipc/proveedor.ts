import { eq, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { requirePermission, str, proveedorUpsertHandler, requireSession } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function proveedorListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.proveedor)
    .where(eq(schema.proveedor.activo, true)).orderBy(asc(schema.proveedor.razon_social)).all();
}

// ADR-106: los canales `proveedor:*` son del CRUD universal del core (`proveedor.gestionar`); estos
// dos son del flujo de compras (`compra.registrar`): el Operador elige/crea proveedor sin gestionarlos.

/**
 * Alta rápida desde la pantalla de compras (ADR-103): solo razón social. Delega en el alta del core
 * (ADR-106) para compartir validación y código `PROV-NNNN`; el documento queda vacío (el core lo
 * permite) y la condición fiscal en su valor por defecto hasta que el Supervisor complete la ficha.
 */
export function proveedorCrearRapidoHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const razon_social = str(p['razon_social'], 'razon_social', { max: 120 });
  const { id } = proveedorUpsertHandler(db, {
    razon_social, tipo_documento: 'DNI', numero_documento: '', condicion_fiscal: 'Consumidor Final',
  });
  return db.select().from(schema.proveedor).where(eq(schema.proveedor.id, id)).get()!;
}

export function registerProveedorHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('compra.registrar');
  ipcMain.handle('compra:proveedor-list', async () => proveedorListHandler(db));
  ipcMain.handle('compra:proveedor-crear-rapido', guard(async (_e, p) => proveedorCrearRapidoHandler(db, p)));
}
