// packages/client/src/main/index.ts
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
// Antes de cualquier módulo que abra la BD (GESTION_USER_DATA_DIR redirige userData).
import './userdata-aislado';

// Obligatorio para el instalador Squirrel en Windows; debe ir antes de createWindow
if (started) app.quit();

import { db } from './db/client';
import { runStartup } from './startup';
import { activarFirmaBackup, activarLockoutPersistente, activarRegistroErrores } from '@core/main';
import { presupuestoVencerLoteHandler } from './ipc/presupuesto';
import { registrarHandlersRetail } from './ipc/registrar';
import { ejecutarCatchUp } from './agenda/motor-rutinas';
import { drenarReintentos } from './agenda/worker-reintentos';
import { applyPendingCambiosProgramados } from './scheduler/precios';
import { ElectronPrintService } from '../print/ElectronPrintService';
import { installAppMenu } from './menu/appMenu';
import { getSession, aplicarSeguridadVentana, iniciarTerminal, programarTareaSegura, registrarErroresNoCapturados } from '@core/main';

async function createWindow(): Promise<void> {
  // Revisión 2026-10-20 (P0): errores no capturados al log (no cortan el proceso en plena venta).
  registrarErroresNoCapturados();
  // Revisión 2026-10-20 (P0): el config de la terminal tiene que llegar al contexto del main;
  // antes se descartaba y todas las terminales grababan origin_id='C1'.
  iniciarTerminal(app.getPath('userData'));
  await runStartup(db);
  const printService = new ElectronPrintService(() => new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  }));

  // El menú nativo necesita la ventana, que se crea más abajo: el canal universal `menu:rebuild`
  // (core) llama a esta referencia, que se completa al instalar el menú.
  let reconstruirMenu: () => void = () => {};
  registrarHandlersRetail(ipcMain, db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
    printService,
    reconstruirMenu: () => reconstruirMenu(),
    app,
  });

  // ADR-047: catch-up de agenda al abrir (materializa rutinas vencidas mientras estuvo cerrada).
  try { ejecutarCatchUp(db, new Date()); } catch (e) { console.error('[agenda] catch-up fallo:', e); }
  // ADR-047: worker de reintentos de avisos — al abrir y cada 60s mientras la app este abierta.
  // Revisión 2026-10-20 (P0): cada job corre por `programarTareaSegura`: un error de SQLite
  // (SQLITE_BUSY, tabla ausente tras un restore) se registra con el nombre del job en vez de
  // tumbar el proceso main o dejar el intervalo muerto sin rastro.
  programarTareaSegura('avisos-reintentos', 60 * 1000, () => drenarReintentos(db, new Date()), undefined, { ejecutarAlInicio: true });

  // ADR-034: aplicar cambios de precio programados al arrancar y cada 1 hora
  programarTareaSegura('cambios-programados', 60 * 60 * 1000, () => applyPendingCambiosProgramados(db), undefined, { ejecutarAlInicio: true });

  // ADR-046 §3: job de vencimiento de presupuestos. Corre al arrancar y cada 24h;
  // marca emitido -> vencido con compare-and-swap (no pisa conversiones en curso).
  programarTareaSegura('presupuestos-vencidos', 24 * 60 * 60 * 1000, () => presupuestoVencerLoteHandler(db), undefined, { ejecutarAlInicio: true });

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

  // Menú nativo propio (Base + Operación). Se reconstruye por rol vía 'menu:rebuild' (core)
  // que el renderer invoca tras login/logout/rehidratación (ver AuthContext).
  const isDev = !app.isPackaged;
  reconstruirMenu = (): void => {
    const sesion = getSession();
    installAppMenu(win, {
      permisos: sesion?.permisos ?? new Set<string>(),
      autenticado: sesion !== null,
      isDev,
    });
  };
  reconstruirMenu();

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

// ADR-138: el límite de intentos de login se guarda en userData y sobrevive a reiniciar la app.
activarLockoutPersistente();

// ADR-140: los errores de los jobs y los no capturados se guardan en userData y los ve el Supervisor.
activarRegistroErrores();

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
