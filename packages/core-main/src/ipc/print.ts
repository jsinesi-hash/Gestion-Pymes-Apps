import type { IpcMain, BrowserWindow } from 'electron';

export type ImpresorHtml = (html: string) => Promise<void>;

/** Imprime HTML crudo en una ventana oculta (lógica movida de ElectronPrintService.printRawHtml de Retail). */
export function crearImpresorHtml(createWindow: () => BrowserWindow): ImpresorHtml {
  return async (html) => {
    const win = createWindow();
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    } catch (e) {
      win.close();
      throw e;
    }
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: false }, (success, reason) => {
        win.close();
        if (!success) reject(new Error(reason));
        else resolve();
      });
    });
  };
}

export function registerPrintHtmlHandler(ipcMain: IpcMain, imprimirHtml: ImpresorHtml): void {
  ipcMain.handle('print:html', (_e, html: string) => imprimirHtml(html));
}
