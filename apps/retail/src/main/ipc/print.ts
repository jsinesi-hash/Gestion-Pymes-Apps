import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { IPrintService, PrintFormat } from '../../print/types';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export async function printProductLabelHandler(
  db: Db, payload: { id: string; format?: PrintFormat }, service: IPrintService,
): Promise<void> {
  const producto = db.select().from(schema.producto).where(eq(schema.producto.id, payload.id)).get();
  if (!producto) throw new Error('NOT_FOUND');
  // QR y code128 codifican el SKU pelado (ADR-025 + ADR-026). Sin columna codigo_qr.
  await service.printProductLabel({
    codigoQr: producto.sku, nombre: producto.nombre_corto,
    sku: producto.sku, precio: String(producto.precio_venta_lista),
  }, payload.format ?? 'label');
}

export async function printLocationLabelHandler(
  db: Db, payload: { id: string; format?: PrintFormat }, service: IPrintService,
): Promise<void> {
  const ubicacion = db.select().from(schema.ubicacion).where(eq(schema.ubicacion.id, payload.id)).get();
  if (!ubicacion) throw new Error('NOT_FOUND');
  await service.printLocationLabel({
    codigoQr: ubicacion.codigo, codigo: ubicacion.codigo,
    descripcion: ubicacion.descripcion ?? ubicacion.codigo,
  }, payload.format ?? 'label');
}

export function registerPrintHandlers(ipcMain: IpcMain, db: Db, service: IPrintService): void {
  ipcMain.handle('print:product-label', (_e, p) => printProductLabelHandler(db, p, service));
  ipcMain.handle('print:location-label', (_e, p) => printLocationLabelHandler(db, p, service));
}
