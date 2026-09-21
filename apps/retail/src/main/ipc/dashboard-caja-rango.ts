// packages/client/src/main/ipc/dashboard-caja-rango.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

export type CajaTurnoEntry = {
  caja_id: string;
  usuario_nombre: string;
  fecha_apertura: Date;
  ingresos: number;
  egresos: number;
};

export type CajaRangoMedioPago = {
  medio_pago: string;
  monto_total: number;
  recargo_total: number;
};

export type DashboardCajaRango = {
  turnos: CajaTurnoEntry[];
  por_medio_pago: CajaRangoMedioPago[];
  recargo_tarjeta_total: number;
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
    ingresos: sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'ingreso' then ${schema.movimiento_caja.monto} else 0 end), 0)`,
    egresos:  sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'egreso'  then ${schema.movimiento_caja.monto} else 0 end), 0)`,
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
    medio_pago:    r.medio_pago,
    monto_total:   r.monto_total_centavos / 100,
    recargo_total: r.recargo_total_centavos / 100,
  }));

  const tarjeta = mediosRaw.find(r => r.medio_pago === 'tarjeta');
  const recargo_tarjeta_total = tarjeta ? tarjeta.recargo_total_centavos / 100 : 0;

  return { turnos, por_medio_pago, recargo_tarjeta_total };
}

export function registerDashboardCajaRangoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:caja-rango', guard(async (_e, p) => dashboardCajaRangoHandler(db, p)));
}
