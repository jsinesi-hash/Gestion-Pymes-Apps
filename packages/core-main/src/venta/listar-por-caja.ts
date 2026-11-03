import { eq, and, desc, inArray } from 'drizzle-orm';
import { nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '@core/db';
import type { IpcMain } from 'electron';
import { requireSession } from '../auth/guard';
import type { VentaDb } from './types';

export function ventaListByCajaHandler(db: VentaDb, payload: { caja_id: string }) {
  return db.select({
    id: schema.venta.id,
    numero_interno: schema.venta.numero_interno,
    fecha: schema.venta.fecha,
    total: schema.venta.total,
    estado: schema.venta.estado,
    forma_pago: schema.venta.forma_pago,
    cliente_nombre_raw: schema.cliente.nombre,
    cliente_apellido_raw: schema.cliente.apellido,
  }).from(schema.venta)
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.venta.cliente_id))
    .where(and(
      eq(schema.venta.caja_id, payload.caja_id),
      inArray(schema.venta.estado, ['confirmada', 'anulada']),
    ))
    .orderBy(desc(schema.venta.fecha))
    .all()
    .map(({ cliente_nombre_raw, cliente_apellido_raw, ...r }) => ({
      ...r,
      cliente_nombre: cliente_nombre_raw != null
        ? nombreCompletoCliente({ nombre: cliente_nombre_raw, apellido: cliente_apellido_raw })
        : null,
    }));
}

/**
 * Canal universal: lo registraban Retail y Elaborados por separado. Exige sesión (antes respondía
 * a cualquiera) pero no un permiso puntual: lo lee la vista de caja de ambos roles. El guard vive
 * acá y no en el handler puro, que usan tests y otros handlers ya autenticados.
 */
export function registerVentaListByCajaHandler(ipcMain: IpcMain, db: VentaDb): void {
  ipcMain.handle('venta:listByCaja', async (_e, p: { caja_id: string }) => {
    requireSession();
    return ventaListByCajaHandler(db, p);
  });
}
