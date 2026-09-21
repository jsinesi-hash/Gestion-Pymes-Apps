// packages/client/src/main/ipc/dashboard-proveedores.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql, desc, inArray, notInArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

export type ProveedorRankingEntry = {
  proveedor_id: string;
  razon_social: string;
  gasto: number;
};

export type DashboardProveedoresRango = {
  ranking: ProveedorRankingEntry[];
};

export type DashboardProveedoresEstado = {
  ocs_pendientes: number;
  ocs_sugeridas_sin_resolver: number;
};

export function dashboardProveedoresRangoHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): DashboardProveedoresRango {
  const { desde, hasta } = params;

  const ranking = db.select({
    proveedor_id: schema.orden_compra.proveedor_id,
    razon_social: schema.proveedor.razon_social,
    gasto_centavos: sql<number>`cast(sum(${schema.item_oc.cantidad_recibida} * ${schema.item_oc.costo_unitario_centavos}) as integer)`,
  }).from(schema.item_oc)
    .innerJoin(schema.orden_compra, eq(schema.item_oc.orden_compra_id, schema.orden_compra.id))
    .innerJoin(schema.proveedor, eq(schema.orden_compra.proveedor_id, schema.proveedor.id))
    .where(and(
      inArray(schema.orden_compra.estado, ['recibida_parcial', 'recibida_total', 'cerrada']),
      gte(schema.orden_compra.fecha, desde),
      lte(schema.orden_compra.fecha, hasta),
    ))
    .groupBy(schema.orden_compra.proveedor_id)
    .orderBy(desc(sql`sum(${schema.item_oc.cantidad_recibida} * ${schema.item_oc.costo_unitario_centavos})`))
    .limit(10)
    .all()
    .map(r => ({
      proveedor_id: r.proveedor_id,
      razon_social: r.razon_social,
      gasto: r.gasto_centavos / 100,
    }));

  return { ranking };
}

export function dashboardProveedoresEstadoHandler(db: Db): DashboardProveedoresEstado {
  const pendientesRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.orden_compra)
    .where(inArray(schema.orden_compra.estado, ['emitida', 'recibida_parcial']))
    .get()!;

  const sugeridasRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.orden_compra)
    .where(and(
      eq(schema.orden_compra.tipo, 'sugerida'),
      notInArray(schema.orden_compra.estado, ['recibida_total', 'cerrada', 'anulada']),
    ))
    .get()!;

  return {
    ocs_pendientes:             pendientesRow.count ?? 0,
    ocs_sugeridas_sin_resolver: sugeridasRow.count ?? 0,
  };
}

export function registerDashboardProveedoresHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:proveedores-rango',  guard(async (_e, p) => dashboardProveedoresRangoHandler(db, p)));
  ipcMain.handle('dashboard:proveedores-estado', guard(async ()       => dashboardProveedoresEstadoHandler(db)));
}
