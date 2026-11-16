import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { registerCoreHandlers, ipcConPoliticas, type ImpresorHtml } from '@core/main';
import type * as schema from '../db/schema';
import { navegacionElaborados } from '../../common/navegacion';
import { EXPORTADORES_REPORTES } from '../reportes/exportadores';
import { POLITICAS_CANALES_ELABORADOS } from './politicas-canales';
import { registerArticuloHandlers } from './articulo';
import { registerMovimientoArticuloHandlers } from './movimiento-articulo';
import { registerRecetaProduccionHandlers } from './receta-produccion';
import { registerProduccionHandlers } from './produccion';
import { registerCompraHandlers } from './compra';
import { registerProveedorHandlers } from './proveedor';
import { registerListaPrecioHandlers } from './lista-precio';
import { registerReporteHandlers } from './reporte';
import { registerCategoriaVentaHandlers } from './categoria-venta';
import { registerGrupoModificadorHandlers } from './grupo-modificador';
import { registerProductoVentaHandlers } from './producto-venta';
import { registerDemoCatalogHandlers } from './demo-catalog';
import { registerVentaHandlers } from './venta';
import { registerVentaEsperaHandlers } from './venta-espera';

type Db = BetterSQLite3Database<typeof schema>;

export type RegistrarElaboradosDeps = {
  migrationsFolder: string;
  imprimirHtml: ImpresorHtml;
};

/**
 * Registra todos los canales IPC de Elaborados (universales del núcleo + propios), cada uno con
 * la política de `politicas-canales.ts` (ADR-145). Vive aparte de `index.ts` para que el test de
 * permisos registre exactamente los mismos canales.
 */
export function registrarHandlersElaborados(ipcMain: IpcMain, db: Db, deps: RegistrarElaboradosDeps): void {
  const ipc = ipcConPoliticas(ipcMain, POLITICAS_CANALES_ELABORADOS);
  registerCoreHandlers(ipc, db, {
    migrationsFolder: deps.migrationsFolder,
    navegacion: navegacionElaborados,
    exportadores: EXPORTADORES_REPORTES,
    imprimirHtml: deps.imprimirHtml,
  });
  registerArticuloHandlers(ipc, db);
  registerMovimientoArticuloHandlers(ipc, db);
  registerRecetaProduccionHandlers(ipc, db);
  registerProduccionHandlers(ipc, db);
  registerCompraHandlers(ipc, db);
  registerProveedorHandlers(ipc, db);
  registerListaPrecioHandlers(ipc, db);
  registerReporteHandlers(ipc, db);
  registerCategoriaVentaHandlers(ipc, db);
  registerGrupoModificadorHandlers(ipc, db);
  registerProductoVentaHandlers(ipc, db);
  registerDemoCatalogHandlers(ipc, db);
  registerVentaHandlers(ipc, db);
  registerVentaEsperaHandlers(ipc, db);
}
