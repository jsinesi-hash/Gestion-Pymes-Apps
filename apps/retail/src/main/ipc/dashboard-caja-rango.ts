// packages/client/src/main/ipc/dashboard-caja-rango.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-157: montos en centavos.
export type CajaTurnoEntry = {
  caja_id: string;
  usuario_nombre: string;
  fecha_apertura: Date;
  ingresos_centavos: number;
  egresos_centavos: number;
};

export type CajaRangoMedioPago = {
  medio_pago: string;
  monto_total_centavos: number;
  recargo_total_centavos: number;
};

export type DashboardCajaRango = {
  turnos: CajaTurnoEntry[];
  por_medio_pago: CajaRangoMedioPago[];
  recargo_tarjeta_total_centavos: number;
};

export function dashboardCajaRangoHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): DashboardCajaRango {
  const { desde, hasta } = params;

  const turnos = db.select({
    caja_id:        schema.caja.id,
    usuario_nombre: schema.usuario.nombre_completo,
    fecha_apertura: schema.caja.fecha_apertura,
    ingresos_centavos: sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'ingreso' then ${schema.movimiento_caja.monto_centavos} else 0 end), 0)`,
    egresos_centavos:  sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'egreso'  then ${schema.movimiento_caja.monto_centavos} else 0 end), 0)`,
  }).from(schema.caja)
    .innerJoin(schema.usuario, eq(schema.caja.usuario_id, schema.usuario.id))
    .leftJoin(schema.movimiento_caja, eq(schema.movimiento_caja.caja_id, schema.caja.id))
    .where(and(
      gte(schema.caja.fecha_apertura, desde),
      lte(schema.caja.fecha_apertura, hasta),
    ))
    .groupBy(schema.caja.id)
    .orderBy(schema.caja.fecha_apertura)
    .all()
    .map(r => ({ ...r, fecha_apertura: r.fecha_apertura as Date }));

  const mediosRaw = db.select({
    medio_pago:             schema.venta_pago.medio_pago,
    monto_total_centavos:   sql<number>`coalesce(sum(${schema.venta_pago.monto_centavos}), 0)`,
    recargo_total_centavos: sql<number>`coalesce(sum(${schema.venta_pago.recargo_centavos}), 0)`,
  }).from(schema.venta_pago)
    .innerJoin(schema.venta, eq(schema.venta_pago.venta_id, schema.venta.id))
    .where(and(
      eq(schema.venta.estado, 'confirmada'),
      gte(schema.venta.fecha, desde),
      lte(schema.venta.fecha, hasta),
    ))
    .groupBy(schema.venta_pago.medio_pago)
    .all();

  const por_medio_pago: CajaRangoMedioPago[] = mediosRaw.map(r => ({
    medio_pago:             r.medio_pago,
    monto_total_centavos:   r.monto_total_centavos,
    recargo_total_centavos: r.recargo_total_centavos,
  }));

  const tarjeta = mediosRaw.find(r => r.medio_pago === 'tarjeta');
  const recargo_tarjeta_total_centavos = tarjeta ? tarjeta.recargo_total_centavos : 0;

  return { turnos, por_medio_pago, recargo_tarjeta_total_centavos };
}

export function registerDashboardCajaRangoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:caja-rango', guard(async (_e, p) => dashboardCajaRangoHandler(db, p)));
}
