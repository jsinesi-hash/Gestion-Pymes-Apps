// apps/elaborados/src/main/index.ts
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
// Antes de cualquier módulo que abra la BD (GESTION_USER_DATA_DIR redirige userData).
import './userdata-aislado';

// Obligatorio para el instalador Squirrel en Windows; debe ir antes de createWindow
if (started) app.quit();

import { db } from './db/client';
import { runStartup } from './startup';
import { registerCoreHandlers, activarFirmaBackup, aplicarSeguridadVentana, crearImpresorHtml, iniciarTerminal, registrarErroresNoCapturados } from '@core/main';
import { navegacionElaborados } from '../common/navegacion';
import { registerArticuloHandlers } from './ipc/articulo';
import { registerMovimientoArticuloHandlers } from './ipc/movimiento-articulo';
import { registerRecetaProduccionHandlers } from './ipc/receta-produccion';
import { registerProduccionHandlers } from './ipc/produccion';
import { registerCompraHandlers } from './ipc/compra';
import { registerProveedorHandlers } from './ipc/proveedor';
import { registerListaPrecioHandlers } from './ipc/lista-precio';
import { registerReporteHandlers } from './ipc/reporte';
import { EXPORTADORES_REPORTES } from './reportes/exportadores';
import { registerCategoriaVentaHandlers } from './ipc/categoria-venta';
import { registerGrupoModificadorHandlers } from './ipc/grupo-modificador';
import { registerProductoVentaHandlers } from './ipc/producto-venta';
import { registerDemoCatalogHandlers } from './ipc/demo-catalog';
import { registerVentaHandlers } from './ipc/venta';
import { registerVentaEsperaHandlers } from './ipc/venta-espera';

async function createWindow(): Promise<void> {
  // Revisión 2026-10-20 (P0): errores no capturados al log (no cortan el proceso en plena venta).
  registrarErroresNoCapturados();
  // Revisión 2026-10-20 (P0): el config de la terminal tiene que llegar al contexto del main;
  // antes se descartaba y todas las terminales grababan origin_id='C1'.
  iniciarTerminal(app.getPath('userData'));
  await runStartup(db);
  registerCoreHandlers(ipcMain, db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
    navegacion: navegacionElaborados,
    exportadores: EXPORTADORES_REPORTES,
    imprimirHtml: crearImpresorHtml(() => new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })),
  });
  registerArticuloHandlers(ipcMain, db);
  registerMovimientoArticuloHandlers(ipcMain, db);
  registerRecetaProduccionHandlers(ipcMain, db);
  registerProduccionHandlers(ipcMain, db);
  registerCompraHandlers(ipcMain, db);
  registerProveedorHandlers(ipcMain, db);
  registerListaPrecioHandlers(ipcMain, db);
  registerReporteHandlers(ipcMain, db);
  registerCategoriaVentaHandlers(ipcMain, db);
  registerGrupoModificadorHandlers(ipcMain, db);
  registerProductoVentaHandlers(ipcMain, db);
  registerDemoCatalogHandlers(ipcMain, db);
  registerVentaHandlers(ipcMain, db);
  registerVentaEsperaHandlers(ipcMain, db);

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

  // Sin menú nativo propio en E1: queda el default de Electron. `AuthContext` llama
  // `menu.rebuild` con `?.`, así que no rompe.

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

// ADR-135: firma HMAC de los .fbk con la clave de esta instalación (perezosa: safeStorage solo
// responde con la app lista, y el primer backup ocurre dentro de createWindow).
activarFirmaBackup();

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
