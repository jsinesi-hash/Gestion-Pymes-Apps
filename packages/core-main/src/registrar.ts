import type { IpcMain } from 'electron';
import type { Navegacion } from '@ferreteria/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as coreSchema from '@core/db';
import { registerAuthHandlers } from './ipc/auth';
import { registerPreferenciasHandlers } from './ipc/preferencias';
import { registerParametrosHandlers } from './ipc/parametros';
import { registerGeoHandlers } from './ipc/geo';
import { registerImpuestoHandlers } from './ipc/impuesto';
import { registerClienteHandlers } from './ipc/cliente';
import { registerCtaCteHandlers } from './ipc/ctacte';
import { registerProveedorHandlers, type ProveedorHooks } from './ipc/proveedor';
import { registerCajaHandlers, type CajaHooks } from './ipc/caja';
import { registerBackupHandlers } from './ipc/backup';
import { registerRestoreHandlers } from './ipc/restore';
import { registerDialogHandlers } from './ipc/dialog';
import { registerMenuHandlers } from './ipc/menu';
import { registerVentaListByCajaHandler } from './venta/listar-por-caja';
import { registerPrintHtmlHandler, type ImpresorHtml } from './ipc/print';
import { registerExportarHandlers, crearExportarEjecutar, EXPORTADORES_CORE, type Exportador } from './ipc/exportar';

export type CoreHandlersOpts = {
  migrationsFolder: string;
  navegacion: Navegacion;
  exportadores?: readonly Exportador[];
  caja?: CajaHooks;
  proveedor?: ProveedorHooks;
  imprimirHtml?: ImpresorHtml;
  /** Reconstruye el menú nativo según la sesión; la app lo inyecta (el core no conoce su menú). */
  reconstruirMenu?: () => void;
};

/** Registra TODOS los canales IPC universales. Lo llama el main/index.ts de cada app. */
export function registerCoreHandlers(ipcMain: IpcMain, db: BetterSQLite3Database<typeof coreSchema>, opts: CoreHandlersOpts): void {
  registerAuthHandlers(ipcMain, db);
  registerPreferenciasHandlers(ipcMain, db, opts.navegacion);
  registerParametrosHandlers(ipcMain, db);
  registerGeoHandlers(ipcMain, db);
  registerImpuestoHandlers(ipcMain, db);
  registerClienteHandlers(ipcMain, db);
  registerCtaCteHandlers(ipcMain, db);
  registerProveedorHandlers(ipcMain, db, opts.proveedor ?? {});
  registerCajaHandlers(ipcMain, db, opts.caja ?? {});
  registerBackupHandlers(ipcMain, db);
  registerRestoreHandlers(ipcMain, db, { migrationsFolder: opts.migrationsFolder });
  registerDialogHandlers(ipcMain);
  registerVentaListByCajaHandler(ipcMain, db as never);
  registerMenuHandlers(ipcMain, opts.reconstruirMenu);
  registerExportarHandlers(ipcMain, db, crearExportarEjecutar([...EXPORTADORES_CORE, ...(opts.exportadores ?? [])]));
  if (opts.imprimirHtml) registerPrintHtmlHandler(ipcMain, opts.imprimirHtml);
}
