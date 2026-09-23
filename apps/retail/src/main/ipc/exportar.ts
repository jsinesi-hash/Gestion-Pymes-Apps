import { crearExportarEjecutar, EXPORTADORES_CORE, type Exportador } from '@core/main';
import {
  exportProductos, exportStock, exportUbicaciones,
  exportProveedores, exportVentas,
  exportReporteVentas,
  exportCategorias, exportMarcas, exportUnidades, exportSinonimos,
  exportTransportistas, exportRemitos, exportPresupuestos,
} from '@ferreteria/shared';
import { productoQueryAll } from './producto';
import { stockQueryAll } from './stock';
import { ubicacionQueryAll } from './ubicacion';
import { proveedorQueryAll } from './proveedor';
import { ventaQueryAll, ventaDetalladoQueryAll } from './venta';
import { reporteVentasQueryAll, reporteVentasDetalleQueryAll } from './reportes';
import { categoriaQueryAll } from './categoria';
import { marcaQueryAll } from './marca';
import { unidadQueryAll } from './unidad';
import { sinonimoQueryAll } from './sinonimo';
import { transportistaQueryAll } from './transportista';
import { remitoListarHandler } from './remito';
import { presupuestoListarHandler } from './presupuesto';

export const EXPORTADORES_RETAIL: readonly Exportador[] = [
  { definicion: exportProductos,  fetch: (db, r) => productoQueryAll(db as any, (r.filtros ?? {}) as any) as any },
  { definicion: exportStock,      fetch: (db, r) => stockQueryAll(db as any, (r.filtros ?? {}) as any) as any },
  { definicion: exportUbicaciones,fetch: (db) => ubicacionQueryAll(db as any) as any },
  { definicion: exportProveedores,fetch: (db) => proveedorQueryAll(db as any) as any },
  { definicion: exportVentas, fetch: (db, r) => (r.perfilId === 'detallado'
      ? ventaDetalladoQueryAll(db as any, (r.filtros ?? {}) as any) : ventaQueryAll(db as any, (r.filtros ?? {}) as any)) as any },
  { definicion: exportReporteVentas, fetch: (db, r) => (r.perfilId === 'detalle'
      ? reporteVentasDetalleQueryAll(db as any, (r.filtros ?? {}) as any) : reporteVentasQueryAll(db as any, (r.filtros ?? {}) as any)) as any },
  { definicion: exportCategorias,     fetch: (db) => categoriaQueryAll(db as any) as any },
  { definicion: exportMarcas,         fetch: (db) => marcaQueryAll(db as any) as any },
  { definicion: exportUnidades,       fetch: (db) => unidadQueryAll(db as any) as any },
  { definicion: exportSinonimos,      fetch: (db) => sinonimoQueryAll(db as any) as any },
  { definicion: exportTransportistas, fetch: (db) => transportistaQueryAll(db as any) as any },
  { definicion: exportRemitos,        fetch: (db) => remitoListarHandler(db as any) as any },
  { definicion: exportPresupuestos,   fetch: (db) => presupuestoListarHandler(db as any) as any },
];

/** Conserva el nombre que usan los tests de Retail (exportar.handlers/queries/seed). */
export const exportarEjecutar = crearExportarEjecutar([...EXPORTADORES_CORE, ...EXPORTADORES_RETAIL]);
