import type { IpcMain } from 'electron';
import { registerCoreHandlers, ipcConPoliticas } from '@core/main';
import { POLITICAS_CANALES_RETAIL } from './politicas-canales';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { IPrintService } from '../../print/types';
import type * as schema from '../db/schema';
import { navegacionRetail } from '../../common/navegacion';
import { avisoCierreCaja } from './caja-cierre-aviso';
import { EXPORTADORES_RETAIL } from './exportar';
import { proveedorHooksRetail } from './proveedor';
import { registerMarcaHandlers } from './marca';
import { registerCategoriaHandlers } from './categoria';
import { registerUbicacionHandlers } from './ubicacion';
import { registerExistenciasHandlers } from './existencias';
import { registerMovimientoStockHandlers } from './movimiento-stock';
import { registerProductoHandlers } from './producto';
import { registerEquivalenciaHandlers } from './equivalencia';
import { registerPrintHandlers } from './print';
import { registerStockHandlers } from './stock';
import { registerListaPrecioHandlers } from './lista-precio';
import { registerReglaPrecioHandlers } from './regla-precio';
import { registerPriceBatchHandlers } from './price-batch';
import { registerVentaHandlers } from './venta';
import { registerImportarHandlers } from './importar';
import { registerDashboardHandlers } from './dashboard';
import { registerDashboardRangoHandlers } from './dashboard-rango';
import { registerDashboardCajaRangoHandlers } from './dashboard-caja-rango';
import { registerDashboardClientesHandlers } from './dashboard-clientes';
import { registerDashboardProveedoresHandlers } from './dashboard-proveedores';
import { registerReportesHandlers } from './reportes';
import { registerProductoProveedorHandlers } from './producto-proveedor';
import { registerOcHandlers } from './ordenes-compra';
import { registerRecepcionHandlers } from './recepcion';
import { registerDialogRetailHandlers } from './dialog';
import { registerEtiquetasHandlers } from './etiquetas';
import { registerVentaEsperaHandlers } from './venta-espera';
import { registerCambioProgramadoHandlers } from './cambio-programado';
import { registerListaPrecioValorHandlers } from './lista-precio-valor';
import { registerImportacionCostoHandlers } from './importacion-costo';
import { registerImportacionCatalogoHandlers } from './importacion-catalogo';
import { registerUnidadHandlers } from './unidad';
import { registerDemoCatalogHandlers } from './demo-catalog';
import { registerSinonimoHandlers } from './sinonimo';
import { registerPresentacionHandlers } from './presentacion';
import { registerRemitoHandlers } from './remito';
import { registerTransportistaHandlers } from './transportista';
import { registerPresupuestoHandlers } from './presupuesto';
import { registerAgendaHandlers } from './agenda';
import { registerActualizacionHandlers } from './actualizacion';

type Db = BetterSQLite3Database<typeof schema>;

export type RegistrarRetailDeps = {
  migrationsFolder: string;
  printService: IPrintService;
  reconstruirMenu: () => void;
  app: Parameters<typeof registerActualizacionHandlers>[2];
};

/**
 * Registra todos los canales IPC de Retail (universales del núcleo + propios). Vive aparte de
 * `index.ts` para que el test de permisos (ADR-145) registre exactamente los mismos canales.
 * Cada canal se registra con la política de `politicas-canales.ts`.
 */
export function registrarHandlersRetail(ipcMain: IpcMain, db: Db, deps: RegistrarRetailDeps): void {
  // ADR-145: todo canal pasa por su política (sesión o permiso); uno sin política no arranca.
  const ipc = ipcConPoliticas(ipcMain, POLITICAS_CANALES_RETAIL);
  registerCoreHandlers(ipc, db, {
    reconstruirMenu: deps.reconstruirMenu,
    migrationsFolder: deps.migrationsFolder,
    navegacion: navegacionRetail,
    exportadores: EXPORTADORES_RETAIL,
    caja: { onCajaCerrada: avisoCierreCaja },
    proveedor: proveedorHooksRetail,
    imprimirHtml: (h) => deps.printService.printRawHtml(h),
  });
  registerDialogRetailHandlers(ipc);

  registerMarcaHandlers(ipc, db);
  registerCategoriaHandlers(ipc, db);
  registerUbicacionHandlers(ipc, db);
  registerExistenciasHandlers(ipc, db);
  registerMovimientoStockHandlers(ipc, db);
  registerProductoHandlers(ipc, db);
  registerEquivalenciaHandlers(ipc, db);
  registerPrintHandlers(ipc, db, deps.printService);
  registerStockHandlers(ipc, db);
  registerListaPrecioHandlers(ipc, db);
  registerReglaPrecioHandlers(ipc, db);
  registerPriceBatchHandlers(ipc, db);
  registerVentaHandlers(ipc, db);
  registerImportarHandlers(ipc, db);
  registerDashboardHandlers(ipc, db);
  registerDashboardRangoHandlers(ipc, db);
  registerDashboardCajaRangoHandlers(ipc, db);
  registerDashboardClientesHandlers(ipc, db);
  registerDashboardProveedoresHandlers(ipc, db);
  registerReportesHandlers(ipc, db);
  registerProductoProveedorHandlers(ipc, db);
  registerOcHandlers(ipc, db);
  registerRecepcionHandlers(ipc, db);
  registerEtiquetasHandlers(ipc, db);
  registerVentaEsperaHandlers(ipc, db);
  registerCambioProgramadoHandlers(ipc, db);
  registerListaPrecioValorHandlers(ipc, db);
  registerImportacionCostoHandlers(ipc, db);
  registerImportacionCatalogoHandlers(ipc, db);
  registerUnidadHandlers(ipc, db);
  registerDemoCatalogHandlers(ipc, db);
  registerSinonimoHandlers(ipc, db);
  registerPresentacionHandlers(ipc, db);
  registerRemitoHandlers(ipc, db);
  registerTransportistaHandlers(ipc, db);
  registerPresupuestoHandlers(ipc, db);
  registerAgendaHandlers(ipc, db);
  registerActualizacionHandlers(ipc, db, deps.app);
}
