import type { ExportRequest } from '@ferreteria/shared';
import type { Exportador } from '@core/main';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import {
  exportVentasPeriodo, exportVentasMedio, exportVentasProducto, exportSabores, exportStockAlertas,
} from '../../common/export-reportes';
import {
  reporteVentasPeriodoQuery, reporteVentasProductoQuery, reporteStockAlertasQuery,
} from '../ipc/reporte';

type Db = BetterSQLite3Database<typeof schema>;

const pad = (n: number) => String(n).padStart(2, '0');
const dia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Rango a exportar: con alcance "filtrado" el período elegido en pantalla; con "todo", todo el
 * historial (de 2000 a mañana, cubre cualquier venta real).
 */
export function rangoExport(req: ExportRequest): { desde: string; hasta: string } {
  const f = req.alcance === 'filtrado' ? req.filtros : undefined;
  if (f && typeof f['desde'] === 'string' && typeof f['hasta'] === 'string') return { desde: f['desde'], hasta: f['hasta'] };
  const manana = new Date(); manana.setDate(manana.getDate() + 1);
  return { desde: '2000-01-01', hasta: dia(manana) };
}

// Las consultas de reporte reciben el db de la app; el registry del core lo tipa con el esquema core.
const app = (db: unknown) => db as Db;

export const EXPORTADORES_REPORTES: readonly Exportador[] = [
  { definicion: exportVentasPeriodo, fetch: (db, req) => reporteVentasPeriodoQuery(app(db), rangoExport(req)).por_dia as unknown as Record<string, unknown>[] },
  { definicion: exportVentasMedio, fetch: (db, req) => reporteVentasPeriodoQuery(app(db), rangoExport(req)).por_medio as unknown as Record<string, unknown>[] },
  { definicion: exportVentasProducto, fetch: (db, req) => reporteVentasProductoQuery(app(db), rangoExport(req)).productos as unknown as Record<string, unknown>[] },
  { definicion: exportSabores, fetch: (db, req) => reporteVentasProductoQuery(app(db), rangoExport(req)).sabores as unknown as Record<string, unknown>[] },
  { definicion: exportStockAlertas, fetch: (db) => reporteStockAlertasQuery(app(db)) as unknown as Record<string, unknown>[] },
];
