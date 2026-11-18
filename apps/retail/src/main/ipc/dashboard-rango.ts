import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc, gte, lte, sql, inArray, isNull } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '@core/main';

/** ADR-150 §7: las líneas que reemplazó una retoma quedan con lápida y no cuentan. */
const vdViva = () => isNull(schema.venta_detalle.deleted_at);

type Db = BetterSQLite3Database<typeof schema>;

// ─── Types ───────────────────────────────────────────────────────────────────

export type VentasKpisRangoParams = {
  desde: Date;
  hasta: Date;
  categoria_id: string | null;
  producto_id: string | null;
};

// ADR-157: todos los montos de estos dashboards van en centavos.
export type VentasKpisRangoResult = {
  total_centavos: number;
  count: number;
  ticket_promedio_centavos: number;
  importe_iva_centavos: number;
  por_forma_pago: { forma_pago: string; total_centavos: number; count: number }[];
  top_cantidad: { producto_id: string; nombre: string; cantidad: number }[];
  top_margen: { producto_id: string; nombre: string; margen_estimado_centavos: number }[];
};

export type VentasEvolucionParams = {
  desde: Date;
  hasta: Date;
  desde_anterior: Date;
  hasta_anterior: Date;
  categoria_id?: string | null;
};

export type EvolucionPoint = { label: string; actual_centavos: number; anterior_centavos: number };

export type HeatmapEntry = { hora: number; dia_semana: number; total_centavos: number };

export type VentasDiaMesEntry = { dia: number; total_centavos: number };

export type VendedorEntry = {
  usuario_id: string;
  nombre: string;
  total_centavos: number;
  count: number;
};

export type AbcEntry = {
  producto_id: string;
  sku: string;
  nombre: string;
  monto_total_centavos: number;
  cantidad_total: number;
  clase: 'A' | 'B' | 'C';
  pct_acumulado: number;
};

export type MargenCategoriaEntry = {
  categoria_id: string;
  nombre: string;
  margen_total_centavos: number;
  revenue_centavos: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function ventaBaseWhere(desde: Date, hasta: Date) {
  return and(
    eq(schema.venta.estado, 'confirmada'),
    gte(schema.venta.fecha, desde),
    lte(schema.venta.fecha, hasta),
  );
}

function getVentaIdsFiltrados(db: Db, desde: Date, hasta: Date, categoria_id: string): string[] {
  const base = and(
    eq(schema.venta.estado, 'confirmada'),
    gte(schema.venta.fecha, desde),
    lte(schema.venta.fecha, hasta),
  );
  return db
    .selectDistinct({ venta_id: schema.venta_detalle.venta_id })
    .from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(and(base, eq(schema.producto.categoria_id, categoria_id), vdViva()))
    .all()
    .map(r => r.venta_id);
}

// ─── Handler: KPIs por rango ─────────────────────────────────────────────────

export function dashboardVentasKpisRangoHandler(
  db: Db,
  params: VentasKpisRangoParams,
): VentasKpisRangoResult {
  const { desde, hasta, categoria_id, producto_id } = params;
  const base = ventaBaseWhere(desde, hasta);

  let filteredIds: string[] | null = null;
  if (categoria_id || producto_id) {
    const rows = db
      .selectDistinct({ venta_id: schema.venta_detalle.venta_id })
      .from(schema.venta_detalle)
      .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
      .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
      .where(
        and(
          base,
          categoria_id ? eq(schema.producto.categoria_id, categoria_id) : undefined,
          producto_id  ? eq(schema.venta_detalle.producto_id, producto_id) : undefined,
          vdViva(),
        ),
      )
      .all();
    filteredIds = rows.map(r => r.venta_id);
    if (filteredIds.length === 0) {
      return { total_centavos: 0, count: 0, ticket_promedio_centavos: 0, importe_iva_centavos: 0, por_forma_pago: [], top_cantidad: [], top_margen: [] };
    }
  }

  const where = filteredIds
    ? and(base, inArray(schema.venta.id, filteredIds))
    : base;

  const totales = db.select({
    total_centavos: sql<number>`coalesce(sum(${schema.venta.total_centavos}), 0)`,
    count:       sql<number>`count(*)`,
    importe_iva_centavos: sql<number>`coalesce(sum(${schema.venta.importe_iva_centavos}), 0)`,
  }).from(schema.venta).where(where).get()!;

  const count = totales.count ?? 0;
  const total_centavos = totales.total_centavos ?? 0;

  const por_forma_pago = db.select({
    forma_pago: schema.venta.forma_pago,
    total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
    count:      sql<number>`count(*)`,
  }).from(schema.venta).where(where).groupBy(schema.venta.forma_pago).all();

  const detalleWhere = filteredIds
    ? and(base, inArray(schema.venta.id, filteredIds))
    : base;

  const top_cantidad = db.select({
    producto_id: schema.venta_detalle.producto_id,
    nombre:      schema.producto.nombre_corto,
    cantidad:    sql<number>`sum(${schema.venta_detalle.cantidad})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(and(detalleWhere, vdViva()))
    .groupBy(schema.venta_detalle.producto_id)
    .orderBy(desc(sql`sum(${schema.venta_detalle.cantidad})`))
    .limit(10)
    .all();

  const top_margen = db.select({
    producto_id:     schema.venta_detalle.producto_id,
    nombre:          schema.producto.nombre_corto,
    margen_estimado_centavos: sql<number>`CAST(ROUND(sum((${schema.venta_detalle.precio_unitario_centavos} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio_centavos}) * ${schema.venta_detalle.cantidad})) AS INTEGER)`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(and(detalleWhere, vdViva()))
    .groupBy(schema.venta_detalle.producto_id)
    .orderBy(desc(sql`sum((${schema.venta_detalle.precio_unitario_centavos} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio_centavos}) * ${schema.venta_detalle.cantidad})`))
    .limit(10)
    .all();

  return {
    total_centavos, count,
    ticket_promedio_centavos: count > 0 ? Math.round(total_centavos / count) : 0,
    importe_iva_centavos: totales.importe_iva_centavos ?? 0,
    por_forma_pago, top_cantidad, top_margen,
  };
}

// ─── Handler: Evolución temporal (hourly o daily) ───────────────────────────

export function dashboardVentasEvolucionHandler(
  db: Db,
  params: VentasEvolucionParams,
): EvolucionPoint[] {
  const { desde, hasta, desde_anterior, hasta_anterior, categoria_id } = params;
  const diffMs = hasta.getTime() - desde.getTime();
  const isHourly = diffMs <= 25 * 60 * 60 * 1000;

  const idsActual   = categoria_id ? getVentaIdsFiltrados(db, desde, hasta, categoria_id) : null;
  const idsAnterior = categoria_id ? getVentaIdsFiltrados(db, desde_anterior, hasta_anterior, categoria_id) : null;

  if (isHourly) {
    const fetchHoraria = (d: Date, h: Date, ids: string[] | null) => {
      if (ids !== null && ids.length === 0) return [];
      const baseWhere = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, d), lte(schema.venta.fecha, h));
      const where = ids ? and(baseWhere, inArray(schema.venta.id, ids)) : baseWhere;
      return db.select({
        hora:  sql<number>`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
        total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
      }).from(schema.venta)
        .where(where)
        .groupBy(sql`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`)
        .all();
    };

    const actual   = fetchHoraria(desde, hasta, idsActual);
    const anterior = fetchHoraria(desde_anterior, hasta_anterior, idsAnterior);
    return Array.from({ length: 24 }, (_, hora) => ({
      label:    `${hora}h`,
      actual_centavos:   actual.find(r => r.hora === hora)?.total_centavos   ?? 0,
      anterior_centavos: anterior.find(r => r.hora === hora)?.total_centavos ?? 0,
    }));
  }

  const fetchDiaria = (d: Date, h: Date, ids: string[] | null) => {
    if (ids !== null && ids.length === 0) return [];
    const baseWhere = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, d), lte(schema.venta.fecha, h));
    const where = ids ? and(baseWhere, inArray(schema.venta.id, ids)) : baseWhere;
    return db.select({
      fecha_local: sql<string>`date(datetime(${schema.venta.fecha}, 'unixepoch', 'localtime'))`,
      total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
    }).from(schema.venta)
      .where(where)
      .groupBy(sql`date(datetime(${schema.venta.fecha}, 'unixepoch', 'localtime'))`)
      .all();
  };

  const actualRows   = fetchDiaria(desde, hasta, idsActual);
  const anteriorRows = fetchDiaria(desde_anterior, hasta_anterior, idsAnterior);

  const days    = Math.ceil(diffMs / 86400000) + 1;
  const antDays = Math.ceil((hasta_anterior.getTime() - desde_anterior.getTime()) / 86400000) + 1;
  const maxDays = Math.max(days, antDays);

  return Array.from({ length: maxDays }, (_, i) => {
    const dAct = new Date(desde.getTime() + i * 86400000);
    const dAnt = new Date(desde_anterior.getTime() + i * 86400000);
    return {
      label:    `Día ${i + 1}`,
      actual_centavos:   actualRows.find(r => r.fecha_local   === localDateStr(dAct))?.total_centavos ?? 0,
      anterior_centavos: anteriorRows.find(r => r.fecha_local === localDateStr(dAnt))?.total_centavos ?? 0,
    };
  });
}

// ─── Handler: Heatmap hora × día de semana ───────────────────────────────────

export function dashboardVentasHeatmapHandler(
  db: Db,
  params: { desde: Date; hasta: Date; categoria_id?: string | null },
): HeatmapEntry[] {
  const ids = params.categoria_id ? getVentaIdsFiltrados(db, params.desde, params.hasta, params.categoria_id) : null;
  if (ids !== null && ids.length === 0) return [];
  const base = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, params.desde), lte(schema.venta.fecha, params.hasta));
  const where = ids ? and(base, inArray(schema.venta.id, ids)) : base;
  return db.select({
    hora:       sql<number>`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
    dia_semana: sql<number>`CAST(strftime('%w', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
    total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
  }).from(schema.venta)
    .where(where)
    .groupBy(
      sql`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
      sql`CAST(strftime('%w', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
    )
    .all();
}

// ─── Handler: Distribución por día del mes ───────────────────────────────────

export function dashboardVentasDiaMesHandler(
  db: Db,
  params: { desde: Date; hasta: Date; categoria_id?: string | null },
): VentasDiaMesEntry[] {
  const ids = params.categoria_id ? getVentaIdsFiltrados(db, params.desde, params.hasta, params.categoria_id) : null;
  if (ids !== null && ids.length === 0) return [];
  const base = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, params.desde), lte(schema.venta.fecha, params.hasta));
  const where = ids ? and(base, inArray(schema.venta.id, ids)) : base;
  return db.select({
    dia:   sql<number>`CAST(strftime('%d', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
    total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
  }).from(schema.venta)
    .where(where)
    .groupBy(sql`CAST(strftime('%d', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`)
    .orderBy(sql`CAST(strftime('%d', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`)
    .all();
}

// ─── Handler: Ranking por vendedor ───────────────────────────────────────────

export function dashboardVentasVendedorHandler(
  db: Db,
  params: { desde: Date; hasta: Date; categoria_id?: string | null },
): VendedorEntry[] {
  const ids = params.categoria_id ? getVentaIdsFiltrados(db, params.desde, params.hasta, params.categoria_id) : null;
  if (ids !== null && ids.length === 0) return [];
  const base = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, params.desde), lte(schema.venta.fecha, params.hasta));
  const where = ids ? and(base, inArray(schema.venta.id, ids)) : base;
  return db.select({
    usuario_id: schema.venta.usuario_id,
    nombre:     schema.usuario.nombre_completo,
    total_centavos: sql<number>`sum(${schema.venta.total_centavos})`,
    count:      sql<number>`count(*)`,
  }).from(schema.venta)
    .innerJoin(schema.usuario, eq(schema.venta.usuario_id, schema.usuario.id))
    .where(where)
    .groupBy(schema.venta.usuario_id)
    .orderBy(desc(sql`sum(${schema.venta.total_centavos})`))
    .limit(10)
    .all();
}

// ─── Handler: Curva ABC de productos ─────────────────────────────────────────

export function dashboardProductosAbcHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): AbcEntry[] {
  const base = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, params.desde), lte(schema.venta.fecha, params.hasta));

  const rows = db.select({
    producto_id:    schema.venta_detalle.producto_id,
    sku:            schema.producto.sku,
    nombre:         schema.producto.nombre_corto,
    monto_total_centavos: sql<number>`sum(${schema.venta_detalle.subtotal_centavos})`,
    cantidad_total: sql<number>`sum(${schema.venta_detalle.cantidad})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(and(base, vdViva()))
    .groupBy(schema.venta_detalle.producto_id)
    .orderBy(desc(sql`sum(${schema.venta_detalle.subtotal_centavos})`))
    .all();

  const totalMonto = rows.reduce((s, r) => s + r.monto_total_centavos, 0);
  let acumulado = 0;
  return rows.map(r => {
    acumulado += r.monto_total_centavos;
    const pct = totalMonto > 0 ? (acumulado / totalMonto) * 100 : 0;
    return {
      ...r,
      clase: (pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C') as 'A' | 'B' | 'C',
      pct_acumulado: pct,
    };
  });
}

// ─── Handler: Margen por categoría ───────────────────────────────────────────

export function dashboardProductosMargenCategoriaHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): MargenCategoriaEntry[] {
  const base = and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, params.desde), lte(schema.venta.fecha, params.hasta));

  return db.select({
    categoria_id: schema.categoria.id,
    nombre:       schema.categoria.nombre,
    margen_total_centavos: sql<number>`CAST(ROUND(sum((${schema.venta_detalle.precio_unitario_centavos} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio_centavos}) * ${schema.venta_detalle.cantidad})) AS INTEGER)`,
    revenue_centavos: sql<number>`sum(${schema.venta_detalle.subtotal_centavos})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .innerJoin(schema.categoria, eq(schema.producto.categoria_id, schema.categoria.id))
    .where(and(base, vdViva()))
    .groupBy(schema.categoria.id)
    .orderBy(desc(sql`sum((${schema.venta_detalle.precio_unitario_centavos} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio_centavos}) * ${schema.venta_detalle.cantidad})`))
    .all();
}

// ─── Registro de handlers IPC ─────────────────────────────────────────────────

export function registerDashboardRangoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:ventas-kpis-rango',         guard(async (_e, p) => dashboardVentasKpisRangoHandler(db, p)));
  ipcMain.handle('dashboard:ventas-evolucion',          guard(async (_e, p) => dashboardVentasEvolucionHandler(db, p)));
  ipcMain.handle('dashboard:ventas-heatmap',            guard(async (_e, p) => dashboardVentasHeatmapHandler(db, p)));
  ipcMain.handle('dashboard:ventas-dia-mes',            guard(async (_e, p) => dashboardVentasDiaMesHandler(db, p)));
  ipcMain.handle('dashboard:ventas-vendedor',           guard(async (_e, p) => dashboardVentasVendedorHandler(db, p)));
  ipcMain.handle('dashboard:productos-abc',             guard(async (_e, p) => dashboardProductosAbcHandler(db, p)));
  ipcMain.handle('dashboard:productos-margen-categoria',guard(async (_e, p) => dashboardProductosMargenCategoriaHandler(db, p)));
}
