import fs from 'node:fs';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ExportRequest } from '@ferreteria/shared';
import {
  exportProductos, exportStock, exportUbicaciones,
  exportProveedores, exportClientes, exportVentas, exportCaja, exportCtaCte,
  exportReporteVentas,
  exportCategorias, exportMarcas, exportUnidades, exportSinonimos,
  exportTransportistas, exportRemitos, exportPresupuestos,
} from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '@core/main';
import { buildCsv } from '@core/main';
import { buildXlsx } from '@core/main';
import { productoQueryAll } from './producto';
import { stockQueryAll } from './stock';
import { ubicacionQueryAll } from './ubicacion';
import { proveedorQueryAll } from './proveedor';
import { clienteQueryAll } from '@core/main';
import { ventaQueryAll, ventaDetalladoQueryAll } from './venta';
import { cajaArqueosQueryAll } from './caja';
import { ctacteQueryAll } from './ctacte';
import { reporteVentasQueryAll, reporteVentasDetalleQueryAll } from './reportes';
import { categoriaQueryAll } from './categoria';
import { marcaQueryAll } from './marca';
import { unidadQueryAll } from './unidad';
import { sinonimoQueryAll } from './sinonimo';
import { transportistaQueryAll } from './transportista';
import { remitoListarHandler } from './remito';
import { presupuestoListarHandler } from './presupuesto';

type Db = BetterSQLite3Database<typeof schema>;

const DEFINICIONES = [
  exportProductos,
  exportStock,
  exportUbicaciones,
  exportProveedores,
  exportClientes,
  exportVentas,
  exportCaja,
  exportCtaCte,
  exportReporteVentas,
  exportCategorias,
  exportMarcas,
  exportUnidades,
  exportSinonimos,
  exportTransportistas,
  exportRemitos,
  exportPresupuestos,
];

function fetchFilas(db: Db, req: ExportRequest): Record<string, unknown>[] {
  const f = req.filtros ?? {};
  switch (req.entidad) {
    case 'productos':   return productoQueryAll(db, f as any) as Record<string, unknown>[];
    case 'stock':       return stockQueryAll(db, f as any) as Record<string, unknown>[];
    case 'ubicaciones': return ubicacionQueryAll(db) as Record<string, unknown>[];
    case 'proveedores': return proveedorQueryAll(db) as Record<string, unknown>[];
    case 'clientes':    return clienteQueryAll(db) as Record<string, unknown>[];
    case 'ventas':
      if (req.perfilId === 'detallado') return ventaDetalladoQueryAll(db, f as any) as Record<string, unknown>[];
      return ventaQueryAll(db, f as any) as Record<string, unknown>[];
    case 'caja':        return cajaArqueosQueryAll(db) as Record<string, unknown>[];
    case 'ctacte':     return ctacteQueryAll(db) as Record<string, unknown>[];
    case 'reporte_ventas':
      if (req.perfilId === 'detalle') return reporteVentasDetalleQueryAll(db, f as any) as Record<string, unknown>[];
      return reporteVentasQueryAll(db, f as any) as Record<string, unknown>[];
    case 'categorias':    return categoriaQueryAll(db) as Record<string, unknown>[];
    case 'marcas':        return marcaQueryAll(db) as Record<string, unknown>[];
    case 'unidades':      return unidadQueryAll(db) as Record<string, unknown>[];
    case 'sinonimos':     return sinonimoQueryAll(db) as Record<string, unknown>[];
    case 'transportistas': return transportistaQueryAll(db) as Record<string, unknown>[];
    case 'remitos':       return remitoListarHandler(db) as Record<string, unknown>[];
    case 'presupuestos':  return presupuestoListarHandler(db) as Record<string, unknown>[];
    default:            throw new Error('ENTIDAD_DESCONOCIDA');
  }
}

function checkPermisos(req: ExportRequest) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const def = DEFINICIONES.find(d => d.entidad === req.entidad);
  if (!def) throw new Error('ENTIDAD_DESCONOCIDA');
  if (!session.permisos.has(def.permiso)) throw new Error('FORBIDDEN');

  const perfil = def.perfiles.find(p => p.id === req.perfilId);
  if (!perfil) throw new Error('PERFIL_DESCONOCIDO');
  if (!session.permisos.has(perfil.permiso)) throw new Error('FORBIDDEN');

  if (perfil.soloFormatos && !perfil.soloFormatos.includes(req.formato)) {
    throw new Error('FORMATO_NO_PERMITIDO');
  }

  return { def, perfil };
}

export async function exportarEjecutar(db: Db, req: ExportRequest, filePath: string): Promise<void> {
  const { def, perfil } = checkPermisos(req);
  const filas = fetchFilas(db, req);

  if (req.formato === 'csv') {
    const content = buildCsv(perfil.columnas as any, filas);
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    const buf = await buildXlsx(perfil.columnas as any, filas, def.label);
    fs.writeFileSync(filePath, buf);
  }
}

export function registerExportarHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('exportar:ejecutar', async (_e, req: ExportRequest) => {
    const { def } = checkPermisos(req);
    const { dialog } = await import('electron');
    const ext = req.formato === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({
      defaultPath: `${def.label}.${ext}`,
      filters: req.formato === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return;
    await exportarEjecutar(db, req, result.filePath);
  });
}
