import { and, eq, gte, inArray, lte, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { requirePermission, requireSession } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

// ── Rango de fechas (ADR-105) ────────────────────────────────────────────────

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDia(v: unknown, campo: string): { y: number; m: number; d: number } {
  if (typeof v !== 'string') throw new Error(`VALIDATION:${campo}:TIPO`);
  const m = FECHA_RE.exec(v);
  if (!m) throw new Error(`VALIDATION:${campo}:TIPO`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(y, mo - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== mo - 1 || f.getDate() !== d) throw new Error(`VALIDATION:${campo}:TIPO`);
  return { y, m: mo, d };
}

/** Rango [desde 00:00, hasta 23:59:59.999] en hora local. `desde`/`hasta` como "YYYY-MM-DD". */
export function rangoDe(payload: unknown): { desde: Date; hasta: Date } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const a = parseDia(p['desde'], 'desde');
  const b = parseDia(p['hasta'], 'hasta');
  const desde = new Date(a.y, a.m - 1, a.d, 0, 0, 0, 0);
  const hasta = new Date(b.y, b.m - 1, b.d, 23, 59, 59, 999);
  if (desde > hasta) throw new Error('VALIDATION:desde:RANGO');
  return { desde, hasta };
}

const claveDia = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

const aCentavos = (pesos: number) => Math.round(pesos * 100);

/** Las ventas que cuentan en cualquier reporte: SOLO confirmadas (en_espera/descartada/anulada no). */
function ventasConfirmadas(db: Db, desde: Date, hasta: Date) {
  return db.select().from(schema.venta)
    .where(and(eq(schema.venta.estado, 'confirmada'), gte(schema.venta.fecha, desde), lte(schema.venta.fecha, hasta)))
    .orderBy(asc(schema.venta.fecha)).all();
}

// SQLite limita las variables por consulta: se trabaja por tandas.
const TANDA = 400;
function porTandas<T>(ids: string[], consulta: (lote: string[]) => T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += TANDA) out.push(...consulta(ids.slice(i, i + TANDA)));
  return out;
}

// ── Ventas por período ───────────────────────────────────────────────────────

export type ResumenVentas = {
  cantidad: number; total_centavos: number; neto_centavos: number; costo_centavos: number; margen_centavos: number;
};
export type VentaDia = ResumenVentas & { dia: string };
export type VentaMedio = { medio_pago: string; monto_centavos: number };
export type ReporteVentasPeriodo = { resumen: ResumenVentas; por_dia: VentaDia[]; por_medio: VentaMedio[] };

const vacio = (): ResumenVentas => ({ cantidad: 0, total_centavos: 0, neto_centavos: 0, costo_centavos: 0, margen_centavos: 0 });

/**
 * Total, neto de IVA, costo y margen por día y total del período, más el desglose por medio de pago.
 * El costo sale de los `movimiento_articulo` de la venta, que guardan el costo promedio del momento
 * (margen histórico exacto, no el costo actual). El efectivo se informa neto de vuelto.
 */
export function reporteVentasPeriodoQuery(db: Db, payload: unknown): ReporteVentasPeriodo {
  requireSession();
  const { desde, hasta } = rangoDe(payload);
  const ventas = ventasConfirmadas(db, desde, hasta);
  const ids = ventas.map((v) => v.id);

  const costoPorVenta = new Map<string, number>();
  for (const m of porTandas(ids, (lote) => db.select({
    ref: schema.movimiento_articulo.referencia_id, cantidad: schema.movimiento_articulo.cantidad,
    costo: schema.movimiento_articulo.costo_unitario_centavos,
  }).from(schema.movimiento_articulo)
    .where(and(eq(schema.movimiento_articulo.motivo, 'venta'), inArray(schema.movimiento_articulo.referencia_id, lote))).all())) {
    costoPorVenta.set(m.ref, (costoPorVenta.get(m.ref) ?? 0) + Math.abs(m.cantidad) * (m.costo ?? 0));
  }

  const resumen = vacio();
  const dias = new Map<string, VentaDia>();
  for (const v of ventas) {
    const total = aCentavos(v.total);
    const neto = total - aCentavos(v.importe_iva);
    const costo = Math.round(costoPorVenta.get(v.id) ?? 0);
    const dia = claveDia(v.fecha);
    const d = dias.get(dia) ?? { dia, ...vacio() };
    for (const r of [resumen, d]) {
      r.cantidad += 1; r.total_centavos += total; r.neto_centavos += neto;
      r.costo_centavos += costo; r.margen_centavos += neto - costo;
    }
    dias.set(dia, d);
  }

  const vueltoPorVenta = new Map(ventas.map((v) => [v.id, v.vuelto_centavos ?? 0]));
  const medios = new Map<string, number>();
  for (const p of porTandas(ids, (lote) => db.select().from(schema.venta_pago)
    .where(inArray(schema.venta_pago.venta_id, lote)).all())) {
    const neto = p.monto_centavos - (p.medio_pago === 'efectivo' ? (vueltoPorVenta.get(p.venta_id) ?? 0) : 0);
    medios.set(p.medio_pago, (medios.get(p.medio_pago) ?? 0) + neto);
  }

  return {
    resumen,
    por_dia: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
    por_medio: [...medios].map(([medio_pago, monto_centavos]) => ({ medio_pago, monto_centavos }))
      .sort((a, b) => b.monto_centavos - a.monto_centavos),
  };
}

// ── Ventas por producto y sabor ──────────────────────────────────────────────

export type VentaProducto = { producto_venta_id: string; descripcion: string; unidades: number; importe_centavos: number };
export type VentaSabor = { descripcion: string; veces: number; consumo: number };
export type ReporteVentasProducto = { productos: VentaProducto[]; sabores: VentaSabor[] };

export function reporteVentasProductoQuery(db: Db, payload: unknown): ReporteVentasProducto {
  requireSession();
  const { desde, hasta } = rangoDe(payload);
  const ids = ventasConfirmadas(db, desde, hasta).map((v) => v.id);
  const lineas = porTandas(ids, (lote) => db.select().from(schema.venta_linea)
    .where(inArray(schema.venta_linea.venta_id, lote)).all());

  const productos = new Map<string, VentaProducto>();
  for (const l of lineas) {
    const p = productos.get(l.producto_venta_id)
      ?? { producto_venta_id: l.producto_venta_id, descripcion: l.descripcion, unidades: 0, importe_centavos: 0 };
    p.unidades += l.cantidad;
    p.importe_centavos += l.subtotal_centavos;
    productos.set(l.producto_venta_id, p);
  }

  const cantidadPorLinea = new Map(lineas.map((l) => [l.id, l.cantidad]));
  const sabores = new Map<string, VentaSabor>();
  for (const m of porTandas([...cantidadPorLinea.keys()], (lote) => db.select().from(schema.venta_linea_modificador)
    .where(inArray(schema.venta_linea_modificador.venta_linea_id, lote)).all())) {
    const cant = cantidadPorLinea.get(m.venta_linea_id) ?? 1;
    const s = sabores.get(m.articulo_id) ?? { descripcion: m.descripcion, veces: 0, consumo: 0 };
    s.veces += cant;
    s.consumo += m.cantidad_consumida * cant;
    sabores.set(m.articulo_id, s);
  }

  return {
    productos: [...productos.values()].sort((a, b) => b.importe_centavos - a.importe_centavos),
    sabores: [...sabores.values()]
      .map((s) => ({ ...s, consumo: Math.round(s.consumo * 1e6) / 1e6 }))
      .sort((a, b) => b.veces - a.veces || a.descripcion.localeCompare(b.descripcion)),
  };
}

// ── Stock negativo y bajo mínimo ─────────────────────────────────────────────

export type FilaStockAlerta = {
  articulo_id: string; nombre: string; unidad: string; stock: number; stock_minimo: number | null;
  estado: 'negativo' | 'bajo_minimo';
};

export function reporteStockAlertasQuery(db: Db): FilaStockAlerta[] {
  requireSession();
  const filas = db.select({
    articulo_id: schema.articulo.id, nombre: schema.articulo.nombre, unidad: schema.articulo.unidad,
    stock: schema.existencia_articulo.stock, stock_minimo: schema.articulo.stock_minimo,
  }).from(schema.articulo)
    .innerJoin(schema.existencia_articulo, eq(schema.existencia_articulo.articulo_id, schema.articulo.id))
    .where(eq(schema.articulo.activo, true)).all();
  const out: FilaStockAlerta[] = [];
  for (const f of filas) {
    if (f.stock < 0) out.push({ ...f, estado: 'negativo' });
    else if (f.stock_minimo != null && f.stock_minimo > 0 && f.stock < f.stock_minimo) out.push({ ...f, estado: 'bajo_minimo' });
  }
  // Primero los negativos (más profundos arriba), luego los bajo mínimo.
  return out.sort((a, b) => (a.estado === b.estado ? a.stock - b.stock : a.estado === 'negativo' ? -1 : 1));
}

export function registerReporteHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('reporte:ventas-periodo', guard(async (_e, p) => reporteVentasPeriodoQuery(db, p)));
  ipcMain.handle('reporte:ventas-producto', guard(async (_e, p) => reporteVentasProductoQuery(db, p)));
  ipcMain.handle('reporte:stock-alertas', guard(async () => reporteStockAlertasQuery(db)));
}
