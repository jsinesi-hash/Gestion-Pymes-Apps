import path from 'node:path';
import { dialog, app } from 'electron';
import type { IpcMain } from 'electron';

export async function seleccionarCarpetaHandler(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar carpeta de destino',
    properties: ['openDirectory'],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

export async function seleccionarArchivoHandler(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar archivo de backup',
    properties: ['openFile'],
    filters: [{ name: 'Backups Ferretería', extensions: ['fbk'] }],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

export function getDefaultBackupPathHandler(): string {
  return path.join(app.getPath('userData'), 'Backups');
}

export async function seleccionarArchivoImportCostoHandler(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar lista de costos del proveedor',
    properties: ['openFile'],
    filters: [{ name: 'Listas de costos', extensions: ['csv', 'xlsx'] }],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

export function registerDialogHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('dialog:seleccionarCarpeta',              () => seleccionarCarpetaHandler());
  ipcMain.handle('dialog:seleccionarArchivo',              () => seleccionarArchivoHandler());
  ipcMain.handle('dialog:getDefaultBackupPath',            () => getDefaultBackupPathHandler());
  ipcMain.handle('dialog:seleccionarArchivoImportCosto',   () => seleccionarArchivoImportCostoHandler());
}
