import { Menu, dialog, app, shell, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { buildMenuTemplate, type MenuAccion, type AyudaAccion } from './appMenuTemplate';

// Ubicación del manual de usuario (HTML). En producción viaja como extraResource
// (Resources/guias/, ver forge.config.ts); en dev vive en el repo bajo
// docs/Documentacion/Usuario/guias/. Se prueban candidatos con existsSync para no
// depender de la profundidad exacta de __dirname entre dev y empaquetado.
function resolveManualPath(): string | null {
  const REL = 'docs/Documentacion/Usuario/guias/manual-completo.html';
  const candidatos = app.isPackaged
    ? [path.join(process.resourcesPath, 'guias', 'manual-completo.html')]
    : [
        // build del main = packages/client/.vite/build → raíz del repo = ../../../..
        path.join(__dirname, '../../../..', REL),
        path.join(process.cwd(), REL),
        path.join(process.cwd(), '../..', REL),
      ];
  for (const c of candidatos) {
    try { if (fs.existsSync(c)) return c; } catch { /* ignorar */ }
  }
  return null;
}

const ATAJOS = [
  'Nueva venta            Ctrl+N',
  'Buscar producto        Ctrl+F',
  'Cerrar caja            Ctrl+F4',
  'Ventas en espera       Ctrl+E',
  'Pantalla completa      F11',
  'Salir                  Ctrl+Q',
].join('\n');

export interface InstallMenuOpts {
  permisos: Set<string>;
  autenticado: boolean;
  isDev: boolean;
}

export function installAppMenu(win: BrowserWindow, opts: InstallMenuOpts): void {
  const onAccion = (action: MenuAccion) => {
    win.webContents.send('menu:accion', { action });
  };
  const onAyuda = (a: AyudaAccion) => {
    if (a === 'guia') {
      const manual = resolveManualPath();
      if (manual) {
        void shell.openPath(manual);
      } else {
        void dialog.showMessageBox(win, {
          type: 'warning',
          title: 'Manual de usuario',
          message: 'No se encontró el manual de usuario',
          detail: 'El archivo de la guía no está disponible en esta instalación.',
        });
      }
      return;
    }
    if (a === 'acerca') {
      void dialog.showMessageBox(win, {
        type: 'info',
        title: 'Acerca de Ferretería',
        message: 'Ferretería — Gestión',
        detail: `Versión ${app.getVersion()}`,
      });
    } else {
      void dialog.showMessageBox(win, {
        type: 'info',
        title: 'Atajos de teclado',
        message: 'Atajos de teclado',
        detail: ATAJOS,
      });
    }
  };

  const template = buildMenuTemplate({ ...opts, onAccion, onAyuda });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
