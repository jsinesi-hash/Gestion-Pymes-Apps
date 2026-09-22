import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export type TopCantidad = { producto_id: string; nombre: string; cantidad: number };
export type TopMargen = { producto_id: string; nombre: string; margen_estimado: number };

export type DashboardVentas = {
  total_dia: number;
  count_dia: number;
  ticket_promedio: number;
  importe_iva_dia: number;
  por_hora: { hora: number; total: number }[];
  por_forma_pago: { forma_pago: string; total: number; count: number }[];
  top_cantidad: TopCantidad[];
  top_margen: TopMargen[];
};

export type StockAlerta = {
  producto_id: string; sku: string; nombre_corto: string;
  stock_fisico: number; stock_minimo: number; dias_hasta_agotar: number | null;
};

export type DashboardStock = {
  valor_inventario: number;
  sin_stock: StockAlerta[];
  bajo_minimo: StockAlerta[];
  sin_movimiento: StockAlerta[];
};

export type ArqueoResumen = {
  caja_id: string; usuario_nombre: string; fecha_cierre: Date; diferencia: number;
};

export type DashboardCaja = {
  caja_activa: { id: string; fecha_apertura: Date; monto_inicial: number } | null;
  ingresos_dia: number;
  egresos_dia: number;
  efectivo_esperado: number;
  arqueos_recientes: ArqueoResumen[];
  umbral_diferencia_caja: number;
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export function dashboardVentasHandler(db: Db): DashboardVentas {
  const { start, end } = todayRange();
  const baseWhere = and(
    eq(schema.venta.estado, 'confirmada'),
    gte(schema.venta.fecha, start),
    lte(schema.venta.fecha, end),
  );

  const totales = db.select({
    total_dia:       sql<number>`coalesce(sum(${schema.venta.total}), 0)`,
    count_dia:       sql<number>`count(*)`,
    importe_iva_dia: sql<number>`coalesce(sum(${schema.venta.importe_iva}), 0)`,
  }).from(schema.venta).where(baseWhere).get()!;

  const count_dia = totales.count_dia ?? 0;
  const total_dia = totales.total_dia ?? 0;

  const por_hora = db.select({
    hora:  sql<number>`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`,
    total: sql<number>`sum(${schema.venta.total})`,
  }).from(schema.venta).where(baseWhere)
    .groupBy(sql`CAST(strftime('%H', datetime(${schema.venta.fecha}, 'unixepoch', 'localtime')) AS INTEGER)`)
    .all();

  const por_forma_pago = db.select({
    forma_pago: schema.venta.forma_pago,
    total:      sql<number>`sum(${schema.venta.total})`,
    count:      sql<number>`count(*)`,
  }).from(schema.venta).where(baseWhere).groupBy(schema.venta.forma_pago).all();

  const top_cantidad = db.select({
    producto_id: schema.venta_detalle.producto_id,
    nombre:      schema.producto.nombre_corto,
    cantidad:    sql<number>`sum(${schema.venta_detalle.cantidad})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(baseWhere)
    .groupBy(schema.venta_detalle.producto_id)
    .orderBy(desc(sql`sum(${schema.venta_detalle.cantidad})`))
    .limit(5).all();

  const top_margen = db.select({
    producto_id:     schema.venta_detalle.producto_id,
    nombre:          schema.producto.nombre_corto,
    margen_estimado: sql<number>`sum((${schema.venta_detalle.precio_unitario} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio}) * ${schema.venta_detalle.cantidad})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .innerJoin(schema.producto, eq(schema.venta_detalle.producto_id, schema.producto.id))
    .where(baseWhere)
    .groupBy(schema.venta_detalle.producto_id)
    .orderBy(desc(sql`sum((${schema.venta_detalle.precio_unitario} / (1.0 + ${schema.venta_detalle.alicuota_iva} / 100.0) - ${schema.producto.precio_costo_promedio}) * ${schema.venta_detalle.cantidad})`))
    .limit(5).all();

  return {
    total_dia, count_dia,
    ticket_promedio: count_dia > 0 ? total_dia / count_dia : 0,
    importe_iva_dia: totales.importe_iva_dia ?? 0,
    por_hora, por_forma_pago, top_cantidad, top_margen,
  };
}

export function dashboardStockHandler(db: Db): DashboardStock {
  const now = new Date();

  const paramRow = db.select({ valor: schema.parametros_sistema.valor })
    .from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'dashboard_dias_sin_movimiento'))
    .get();
  const diasSinMovimiento = paramRow ? Number.parseInt(paramRow.valor, 10) : 90;

  const invRow = db.select({
    valor: sql<number>`coalesce(sum(${schema.existencias.stock_fisico} * ${schema.producto.precio_costo_promedio}), 0)`,
  }).from(schema.producto)
    .innerJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(eq(schema.producto.activo, true))
    .get()!;
  const valor_inventario = invRow.valor ?? 0;

  const hace30Dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const velocidades = db.select({
    producto_id:  schema.venta_detalle.producto_id,
    unidades_30d: sql<number>`sum(${schema.venta_detalle.cantidad})`,
  }).from(schema.venta_detalle)
    .innerJoin(schema.venta, eq(schema.venta_detalle.venta_id, schema.venta.id))
    .where(and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, hace30Dias)))
    .groupBy(schema.venta_detalle.producto_id)
    .all();
  const velocidadMap = new Map(velocidades.map(v => [v.producto_id, v.unidades_30d]));

  const productos = db.select({
    producto_id:             schema.producto.id,
    sku:                     schema.producto.sku,
    nombre_corto:            schema.producto.nombre_corto,
    stock_fisico:            schema.existencias.stock_fisico,
    stock_minimo:            schema.existencias.stock_minimo,
    ultima_fecha_movimiento: schema.existencias.ultima_fecha_movimiento,
  }).from(schema.producto)
    .innerJoin(schema.existencias, eq(schema.existencias.producto_id, schema.producto.id))
    .where(eq(schema.producto.activo, true))
    .all();

  function toAlerta(p: typeof productos[number]): StockAlerta {
    const u30 = velocidadMap.get(p.producto_id) ?? 0;
    const dias_hasta_agotar = u30 > 0 && p.stock_fisico > 0
      ? Math.floor(p.stock_fisico / (u30 / 30))
      : null;
    return {
      producto_id: p.producto_id, sku: p.sku, nombre_corto: p.nombre_corto,
      stock_fisico: p.stock_fisico, stock_minimo: p.stock_minimo, dias_hasta_agotar,
    };
  }

  const sin_stock = productos
    .filter(p => p.stock_fisico === 0)
    .sort((a, b) => (velocidadMap.get(b.producto_id) ?? 0) - (velocidadMap.get(a.producto_id) ?? 0))
    .map(toAlerta);
  const sinStockIds = new Set(sin_stock.map(s => s.producto_id));

  const bajo_minimo = productos
    .filter(p => p.stock_fisico > 0 && p.stock_minimo > 0 && p.stock_fisico <= p.stock_minimo)
    .map(toAlerta)
    .sort((a, b) => {
      if (a.dias_hasta_agotar === null && b.dias_hasta_agotar === null) return 0;
      if (a.dias_hasta_agotar === null) return 1;
      if (b.dias_hasta_agotar === null) return -1;
      return a.dias_hasta_agotar - b.dias_hasta_agotar;
    });

  const umbralMovimiento = new Date(now.getTime() - diasSinMovimiento * 24 * 60 * 60 * 1000);
  const sin_movimiento = productos
    .filter(p => !sinStockIds.has(p.producto_id) && (p.ultima_fecha_movimiento === null || p.ultima_fecha_movimiento < umbralMovimiento))
    // null (never stocked) sorts before dated entries — most stale first.
    .sort((a, b) => {
      if (!a.ultima_fecha_movimiento && !b.ultima_fecha_movimiento) return 0;
      if (!a.ultima_fecha_movimiento) return -1;
      if (!b.ultima_fecha_movimiento) return 1;
      return a.ultima_fecha_movimiento.getTime() - b.ultima_fecha_movimiento.getTime();
    })
    .map(toAlerta);

  return { valor_inventario, sin_stock, bajo_minimo, sin_movimiento };
}

export function dashboardCajaHandler(db: Db): DashboardCaja {
  const { start, end } = todayRange();

  const umbralRow = db.select({ valor: schema.parametros_sistema.valor })
    .from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'umbral_diferencia_caja'))
    .get();
  const umbral_diferencia_caja = umbralRow ? Number.parseFloat(umbralRow.valor) : 0;

  const cajaRow = db.select({
    id:            schema.caja.id,
    fecha_apertura: schema.caja.fecha_apertura,
    monto_inicial: schema.caja.monto_inicial,
  }).from(schema.caja).where(eq(schema.caja.estado, 'abierta')).get() ?? null;

  // System-wide daily totals — all cajas, any user. Intentional: supervisor dashboard overview.
  const movsDia = db.select({
    tipo:      schema.movimiento_caja.tipo,
    monto:     schema.movimiento_caja.monto,
    forma_pago: schema.movimiento_caja.forma_pago,
  }).from(schema.movimiento_caja)
    .where(and(gte(schema.movimiento_caja.fecha, start), lte(schema.movimiento_caja.fecha, end)))
    .all();

  const ingresos_dia = movsDia.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const egresos_dia  = movsDia.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);

  let efectivo_esperado = 0;
  if (cajaRow) {
    const movsCaja = db.select({
      tipo:       schema.movimiento_caja.tipo,
      monto:      schema.movimiento_caja.monto,
      forma_pago: schema.movimiento_caja.forma_pago,
    }).from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.caja_id, cajaRow.id))
      .all();
    const ingEf = movsCaja
      .filter(m => m.tipo === 'ingreso' && (!m.forma_pago || m.forma_pago === 'efectivo'))
      .reduce((s, m) => s + m.monto, 0);
    const egEf = movsCaja
      .filter(m => m.tipo === 'egreso' && (!m.forma_pago || m.forma_pago === 'efectivo'))
      .reduce((s, m) => s + m.monto, 0);
    efectivo_esperado = cajaRow.monto_inicial + ingEf - egEf;
  }

  const arqueos_recientes = db.select({
    caja_id:        schema.caja.id,
    usuario_nombre: schema.usuario.nombre_completo,
    fecha_cierre:   schema.caja.fecha_cierre,
    diferencia:     schema.caja.diferencia,
  }).from(schema.caja)
    .innerJoin(schema.usuario, eq(schema.caja.usuario_id, schema.usuario.id))
    .where(eq(schema.caja.estado, 'cerrada'))
    .orderBy(desc(schema.caja.fecha_cierre))
    .limit(5)
    .all()
    .map(r => ({
      caja_id:        r.caja_id,
      usuario_nombre: r.usuario_nombre,
      fecha_cierre:   r.fecha_cierre as Date,
      diferencia:     r.diferencia ?? 0,
    }));

  return { caja_activa: cajaRow, ingresos_dia, egresos_dia, efectivo_esperado, arqueos_recientes, umbral_diferencia_caja };
}

export function registerDashboardHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:ventas', guard(async () => dashboardVentasHandler(db)));
  ipcMain.handle('dashboard:stock',  guard(async () => dashboardStockHandler(db)));
  ipcMain.handle('dashboard:caja',   guard(async () => dashboardCajaHandler(db)));
}
