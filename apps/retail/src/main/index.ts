// packages/client/src/main/index.ts
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';

// Obligatorio para el instalador Squirrel en Windows; debe ir antes de createWindow
if (started) app.quit();

import { loadTerminalConfig } from './config';
import { db } from './db/client';
import { runStartup } from './startup';
import { registerCoreHandlers } from '@core/main';
import { navegacionRetail } from '../common/navegacion';
import { registerImpuestoHandlers } from './ipc/impuesto';
import { registerMarcaHandlers } from './ipc/marca';
import { registerCategoriaHandlers } from './ipc/categoria';
import { registerUbicacionHandlers } from './ipc/ubicacion';
import { registerExistenciasHandlers } from './ipc/existencias';
import { registerMovimientoStockHandlers } from './ipc/movimiento-stock';
import { registerProductoHandlers } from './ipc/producto';
import { registerEquivalenciaHandlers } from './ipc/equivalencia';
import { registerPrintHandlers } from './ipc/print';
import { registerStockHandlers } from './ipc/stock';
import { registerListaPrecioHandlers } from './ipc/lista-precio';
import { registerReglaPrecioHandlers } from './ipc/regla-precio';
import { registerPriceBatchHandlers } from './ipc/price-batch';
import { avisoCierreCaja } from './ipc/caja-cierre-aviso';
import { registerSmtpHandlers } from './ipc/smtp';
import { registerVentaHandlers } from './ipc/venta';
import { registerImportarHandlers } from './ipc/importar';
import { registerDashboardHandlers } from './ipc/dashboard';
import { registerDashboardRangoHandlers } from './ipc/dashboard-rango';
import { registerDashboardCajaRangoHandlers } from './ipc/dashboard-caja-rango';
import { registerDashboardClientesHandlers }   from './ipc/dashboard-clientes';
import { registerDashboardProveedoresHandlers } from './ipc/dashboard-proveedores';
import { EXPORTADORES_RETAIL } from './ipc/exportar';
import { registerReportesHandlers } from './ipc/reportes';
import { proveedorHooksRetail } from './ipc/proveedor';
import { registerProductoProveedorHandlers } from './ipc/producto-proveedor';
import { registerOcHandlers } from './ipc/ordenes-compra';
import { registerRecepcionHandlers } from './ipc/recepcion';
import { registerDialogRetailHandlers } from './ipc/dialog';
import { registerEtiquetasHandlers } from './ipc/etiquetas';
import { registerVentaEsperaHandlers } from './ipc/venta-espera';
import { registerCambioProgramadoHandlers } from './ipc/cambio-programado';
import { registerListaPrecioValorHandlers } from './ipc/lista-precio-valor';
import { registerImportacionCostoHandlers } from './ipc/importacion-costo';
import { registerImportacionCatalogoHandlers } from './ipc/importacion-catalogo';
import { registerUnidadHandlers } from './ipc/unidad';
import { registerDemoCatalogHandlers } from './ipc/demo-catalog';
import { registerSinonimoHandlers } from './ipc/sinonimo';
import { registerPresentacionHandlers } from './ipc/presentacion';
import { registerRemitoHandlers } from './ipc/remito';
import { registerTransportistaHandlers } from './ipc/transportista';
import { registerPresupuestoHandlers, presupuestoVencerLoteHandler } from './ipc/presupuesto';
import { registerAgendaHandlers } from './ipc/agenda';
import { registerActualizacionHandlers } from './ipc/actualizacion';
import { ejecutarCatchUp } from './agenda/motor-rutinas';
import { drenarReintentos } from './agenda/worker-reintentos';
import { applyPendingCambiosProgramados } from './scheduler/precios';
import { ElectronPrintService } from '../print/ElectronPrintService';
import { installAppMenu } from './menu/appMenu';
import { getSession, aplicarSeguridadVentana } from '@core/main';

async function createWindow(): Promise<void> {
  loadTerminalConfig();
  await runStartup(db);
  const printService = new ElectronPrintService(() => new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  }));

  registerCoreHandlers(ipcMain, db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
    navegacion: navegacionRetail,
    exportadores: EXPORTADORES_RETAIL,
    caja: { onCajaCerrada: avisoCierreCaja },
    proveedor: proveedorHooksRetail,
    imprimirHtml: (h) => printService.printRawHtml(h),
  });
  registerDialogRetailHandlers(ipcMain);

  registerImpuestoHandlers(ipcMain, db);
  registerMarcaHandlers(ipcMain, db);
  registerCategoriaHandlers(ipcMain, db);
  registerUbicacionHandlers(ipcMain, db);
  registerExistenciasHandlers(ipcMain, db);
  registerMovimientoStockHandlers(ipcMain, db);
  registerProductoHandlers(ipcMain, db);
  registerEquivalenciaHandlers(ipcMain, db);
  registerPrintHandlers(ipcMain, db, printService);
  registerStockHandlers(ipcMain, db);
  registerListaPrecioHandlers(ipcMain, db);
  registerReglaPrecioHandlers(ipcMain, db);
  registerPriceBatchHandlers(ipcMain, db);
  registerSmtpHandlers(ipcMain, db);
  registerVentaHandlers(ipcMain, db);
  registerImportarHandlers(ipcMain, db);
  registerDashboardHandlers(ipcMain, db);
  registerDashboardRangoHandlers(ipcMain, db);
  registerDashboardCajaRangoHandlers(ipcMain, db);
  registerDashboardClientesHandlers(ipcMain, db);
  registerDashboardProveedoresHandlers(ipcMain, db);
  registerReportesHandlers(ipcMain, db);
  registerProductoProveedorHandlers(ipcMain, db);
  registerOcHandlers(ipcMain, db);
  registerRecepcionHandlers(ipcMain, db);
  registerEtiquetasHandlers(ipcMain, db);
  registerVentaEsperaHandlers(ipcMain, db);
  registerCambioProgramadoHandlers(ipcMain, db);
  registerListaPrecioValorHandlers(ipcMain, db);
  registerImportacionCostoHandlers(ipcMain, db);
  registerImportacionCatalogoHandlers(ipcMain, db);
  registerUnidadHandlers(ipcMain, db);
  registerDemoCatalogHandlers(ipcMain, db);
  registerSinonimoHandlers(ipcMain, db);
  registerPresentacionHandlers(ipcMain, db);
  registerRemitoHandlers(ipcMain, db);
  registerTransportistaHandlers(ipcMain, db);
  registerPresupuestoHandlers(ipcMain, db);
  registerAgendaHandlers(ipcMain, db);
  registerActualizacionHandlers(ipcMain, db, app);

  // ADR-047: catch-up de agenda al abrir (materializa rutinas vencidas mientras estuvo cerrada).
  try { ejecutarCatchUp(db, new Date()); } catch (e) { console.error('[agenda] catch-up fallo:', e); }
  // ADR-047: worker de reintentos de avisos — al abrir y cada 60s mientras la app este abierta.
  void drenarReintentos(db, new Date()).catch((e) => console.error('[agenda] worker inicial:', e));
  setInterval(() => { void drenarReintentos(db, new Date()).catch(() => {}); }, 60 * 1000);

  // ADR-034: aplicar cambios de precio programados al arrancar y cada 1 hora
  applyPendingCambiosProgramados(db);
  setInterval(() => applyPendingCambiosProgramados(db), 60 * 60 * 1000);

  // ADR-046 §3: job de vencimiento de presupuestos. Corre al arrancar y cada 24h;
  // marca emitido -> vencido con compare-and-swap (no pisa conversiones en curso).
  presupuestoVencerLoteHandler(db);
  setInterval(() => presupuestoVencerLoteHandler(db), 24 * 60 * 60 * 1000);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // se maximiza y se muestra recién en 'ready-to-show', sin flash del tamaño chico
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // invariante de seguridad — no negociable
      nodeIntegration: false,   // invariante de seguridad — no negociable
    },
  });

  // SEC-1 (ADR-077): sin ventanas nuevas, navegación acotada al origen propio y CSP en
  // producción. En dev no aplica CSP para no romper el HMR de Vite.
  aplicarSeguridadVentana(win, {
    isDev: !app.isPackaged,
    devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL ?? null,
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // Menú nativo propio (Base + Operación). Se reconstruye por rol vía 'menu:rebuild'
  // que el renderer invoca tras login/logout/rehidratación (ver AuthContext).
  const isDev = !app.isPackaged;
  const rebuildMenu = (): void => {
    const sesion = getSession();
    installAppMenu(win, {
      permisos: sesion?.permisos ?? new Set<string>(),
      autenticado: sesion !== null,
      isDev,
    });
  };
  rebuildMenu();
  ipcMain.handle('menu:rebuild', () => { rebuildMenu(); });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

// IPC handlers — expuestos al renderer vía preload bridge
ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
