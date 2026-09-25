// apps/elaborados/src/main/index.ts
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';

// Obligatorio para el instalador Squirrel en Windows; debe ir antes de createWindow
if (started) app.quit();

import { loadTerminalConfig } from './config';
import { db } from './db/client';
import { runStartup } from './startup';
import { registerCoreHandlers, aplicarSeguridadVentana } from '@core/main';
import { navegacionElaborados } from '../common/navegacion';
import { registerImpuestoHandlers } from './ipc/impuesto';
import { registerArticuloHandlers } from './ipc/articulo';
import { registerMovimientoArticuloHandlers } from './ipc/movimiento-articulo';
import { registerRecetaProduccionHandlers } from './ipc/receta-produccion';
import { registerProduccionHandlers } from './ipc/produccion';
import { registerCategoriaVentaHandlers } from './ipc/categoria-venta';
import { registerGrupoModificadorHandlers } from './ipc/grupo-modificador';
import { registerProductoVentaHandlers } from './ipc/producto-venta';

async function createWindow(): Promise<void> {
  loadTerminalConfig();
  await runStartup(db);
  registerCoreHandlers(ipcMain, db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
    navegacion: navegacionElaborados,
  });
  registerImpuestoHandlers(ipcMain, db);
  registerArticuloHandlers(ipcMain, db);
  registerMovimientoArticuloHandlers(ipcMain, db);
  registerRecetaProduccionHandlers(ipcMain, db);
  registerProduccionHandlers(ipcMain, db);
  registerCategoriaVentaHandlers(ipcMain, db);
  registerGrupoModificadorHandlers(ipcMain, db);
  registerProductoVentaHandlers(ipcMain, db);

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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
