import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { inicioDelDia, finDelDia, nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';

type Db = BetterSQLite3Database<typeof schema>;
type SqliteDb = Database.Database;

export type ReporteVentasSortCol =
  | 'fecha' | 'numero_interno' | 'cliente' | 'vendedor' | 'total' | 'importe_iva';

export interface ReporteVentasFiltros {
  fechaDesde?: Date;
  fechaHasta?: Date;
  clienteId?: string;
  categoriaId?: string;
  productoId?: string;
  productoTexto?: string;
  usuarioId?: string;
  medioPago?: string;
  sortCol?: ReporteVentasSortCol;
  sortDir?: 'asc' | 'desc';
}

// type (no interface): los alias de tipo obtienen index signature implicita, necesaria
// para el cast a Record<string, unknown>[] que hace exportar.ts.
export type ReporteVentasRow = {
  id: string;
  numero_interno: string;
  fecha: number;
  cliente_nombre_completo: string;
  vendedor_nombre: string;
  medios_pago: string;
  subtotal: number;
  importe_iva: number;
  total: number;
}

export interface ReporteVentasResult {
  rows: ReporteVentasRow[];
  total: number;
  totalImporte: number;
  page: number;
  totalPages: number;
}

export type VentaDetalleExportRow = {
  numero_interno: string;
  fecha: number;
  cliente_nombre_completo: string;
  vendedor_nombre: string;
  sku: string;
  descripcion: string;
  categoria_nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_linea: number;
  alicuota_iva: number;
  subtotal_linea: number;
  total_venta: number;
}

function getSqlite(db: Db): SqliteDb {
  return (db as any).$client as SqliteDb;
}

// Las consultas de este módulo son SQL crudo (no drizzle); c.nombre/c.apellido
// se traen sin concatenar y se combinan acá con el helper compartido, en vez de
// reconstruir "nombre + apellido" a mano en cada SELECT.
type ClienteRawRow = { cliente_nombre_raw: string; cliente_apellido_raw: string | null };

function mapClienteNombreCompleto<T extends ClienteRawRow>(
  row: T,
): Omit<T, 'cliente_nombre_raw' | 'cliente_apellido_raw'> & { cliente_nombre_completo: string } {
  const { cliente_nombre_raw, cliente_apellido_raw, ...rest } = row;
  return {
    ...rest,
    cliente_nombre_completo: nombreCompletoCliente({ nombre: cliente_nombre_raw, apellido: cliente_apellido_raw }),
  };
}

function buildWhere(filtros: ReporteVentasFiltros): { where: string; params: unknown[] } {
  const conds: string[] = ["v.estado = 'confirmada'"];
  const params: unknown[] = [];

  // fechaDesde/fechaHasta son días de CALENDARIO, no instantes: el rango se toma
  // inclusivo de punta a punta del día en hora local, sin importar la hora que traiga
  // el Date recibido.
  if (filtros.fechaDesde) {
    conds.push('v.fecha >= ?');
    params.push(Math.floor(inicioDelDia(filtros.fechaDesde).getTime() / 1000));
  }
  if (filtros.fechaHasta) {
    conds.push('v.fecha <= ?');
    params.push(Math.floor(finDelDia(filtros.fechaHasta).getTime() / 1000));
  }
  if (filtros.clienteId) {
    conds.push('v.cliente_id = ?');
    params.push(filtros.clienteId);
  }
  if (filtros.usuarioId) {
    conds.push('v.usuario_id = ?');
    params.push(filtros.usuarioId);
  }
  if (filtros.medioPago) {
    conds.push('EXISTS (SELECT 1 FROM venta_pago vp2 WHERE vp2.venta_id = v.id AND vp2.medio_pago = ?)');
    params.push(filtros.medioPago);
  }
  if (filtros.categoriaId || filtros.productoId || filtros.productoTexto) {
    let sub = `EXISTS (
      SELECT 1 FROM venta_detalle vd
      JOIN producto p ON p.id = vd.producto_id
      WHERE vd.venta_id = v.id`;
    if (filtros.categoriaId) {
      sub += ' AND p.categoria_id = ?';
      params.push(filtros.categoriaId);
    }
    if (filtros.productoId) {
      sub += ' AND p.id = ?';
      params.push(filtros.productoId);
    }
    if (filtros.productoTexto) {
      const like = `%${filtros.productoTexto}%`;
      sub += ' AND (p.sku LIKE ? OR p.nombre_corto LIKE ? OR vd.descripcion LIKE ?)';
      params.push(like, like, like);
    }
    sub += ')';
    conds.push(sub);
  }

  return { where: conds.join(' AND '), params };
}

const SORT_COL_MAP: Record<string, string> = {
  fecha:           'v.fecha',
  numero_interno:  'v.numero_interno',
  cliente:         "(c.nombre || ' ' || COALESCE(c.apellido, ''))",
  vendedor:        'u.nombre_completo',
  total:           'v.total',
  importe_iva:     'v.importe_iva',
};

function buildOrderBy(sortCol?: string, sortDir?: string): string {
  const col = (sortCol && SORT_COL_MAP[sortCol]) ? SORT_COL_MAP[sortCol] : 'v.fecha';
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}, v.numero_interno ${dir}`;
}

const CABECERA_SQL = `
  SELECT
    v.id, v.numero_interno, v.fecha,
    c.nombre        AS cliente_nombre_raw,
    c.apellido      AS cliente_apellido_raw,
    u.nombre_completo AS vendedor_nombre,
    COALESCE(GROUP_CONCAT(DISTINCT vp.medio_pago), v.forma_pago) AS medios_pago,
    v.subtotal, v.importe_iva, v.total
  FROM venta v
  JOIN cliente c ON c.id = v.cliente_id
  JOIN usuario u ON u.id = v.usuario_id
  LEFT JOIN venta_pago vp ON vp.venta_id = v.id
  WHERE `;

const CABECERA_GROUP_EXPORT = `
  GROUP BY v.id
  ORDER BY v.fecha DESC, v.numero_interno DESC`;

export function detalleVentasHandler(
  db: Db,
  filtros: ReporteVentasFiltros,
  page: number,
  pageSize: number
): ReporteVentasResult {
  const sqlite = getSqlite(db);
  const { where, params } = buildWhere(filtros);
  const orderBy = buildOrderBy(filtros.sortCol, filtros.sortDir);

  const count = sqlite.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(v.total), 0) AS totalImporte
    FROM venta v
    JOIN cliente c ON c.id = v.cliente_id
    JOIN usuario u ON u.id = v.usuario_id
    WHERE ${where}
  `).get(params) as { total: number; totalImporte: number };

  const offset = (page - 1) * pageSize;
  const rawRows = sqlite.prepare(
    CABECERA_SQL + where + `\n  GROUP BY v.id\n  ${orderBy}\n  LIMIT ? OFFSET ?`
  ).all([...params, pageSize, offset]) as ClienteRawRow[];
  const rows = rawRows.map(mapClienteNombreCompleto) as ReporteVentasRow[];

  return {
    rows,
    total: count.total,
    totalImporte: count.totalImporte,
    page,
    totalPages: Math.max(1, Math.ceil(count.total / pageSize)),
  };
}

export function reporteVentasQueryAll(db: Db, filtros: ReporteVentasFiltros): ReporteVentasRow[] {
  const sqlite = getSqlite(db);
  const { where, params } = buildWhere(filtros);
  const rawRows = sqlite.prepare(CABECERA_SQL + where + CABECERA_GROUP_EXPORT).all(params) as ClienteRawRow[];
  return rawRows.map(mapClienteNombreCompleto) as ReporteVentasRow[];
}

export function reporteVentasDetalleQueryAll(db: Db, filtros: ReporteVentasFiltros): VentaDetalleExportRow[] {
  const sqlite = getSqlite(db);
  const { where, params } = buildWhere(filtros);
  const rawRows = sqlite.prepare(`
    SELECT
      v.numero_interno, v.fecha,
      c.nombre         AS cliente_nombre_raw,
      c.apellido       AS cliente_apellido_raw,
      u.nombre_completo AS vendedor_nombre,
      p.sku, vd.descripcion,
      cat.nombre       AS categoria_nombre,
      vd.cantidad, vd.precio_unitario, vd.descuento_linea, vd.alicuota_iva,
      vd.subtotal      AS subtotal_linea,
      v.total          AS total_venta
    FROM venta v
    JOIN cliente c  ON c.id  = v.cliente_id
    JOIN usuario u  ON u.id  = v.usuario_id
    JOIN venta_detalle vd  ON vd.venta_id  = v.id
    JOIN producto p        ON p.id         = vd.producto_id
    JOIN categoria cat     ON cat.id       = p.categoria_id
    WHERE ${where}
    ORDER BY v.fecha DESC, v.numero_interno DESC, vd.id
  `).all(params) as ClienteRawRow[];
  return rawRows.map(mapClienteNombreCompleto) as VentaDetalleExportRow[];
}

export function registerReportesHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('reportes:detalleVentas', (_e, filtros: ReporteVentasFiltros, page = 1, pageSize = 100) => {
    const session = getSession();
    if (!session) throw new Error('UNAUTHENTICATED');
    if (!session.permisos.has('dashboard.ver')) throw new Error('FORBIDDEN');
    return detalleVentasHandler(db, filtros, page, pageSize);
  });
}
