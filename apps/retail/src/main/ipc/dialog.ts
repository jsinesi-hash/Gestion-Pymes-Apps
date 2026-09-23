import { dialog } from 'electron';
import type { IpcMain } from 'electron';

export async function seleccionarArchivoImportCostoHandler(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar lista de costos del proveedor',
    properties: ['openFile'],
    filters: [{ name: 'Listas de costos', extensions: ['csv', 'xlsx'] }],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

export function registerDialogRetailHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('dialog:seleccionarArchivoImportCosto', () => seleccionarArchivoImportCostoHandler());
}
