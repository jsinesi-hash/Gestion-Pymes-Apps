import type { IpcMain } from 'electron';

/**
 * El menú nativo es de cada app (Retail lo arma por rol; Elaborados usa el default de Electron).
 * El canal es universal para que el renderer del núcleo (`AuthContext`) lo llame sin condicionar a
 * qué app corre: la app inyecta `reconstruir` y, sin él, no pasa nada.
 */
export function registerMenuHandlers(ipcMain: IpcMain, reconstruir?: () => void): void {
  ipcMain.handle('menu:rebuild', async () => { reconstruir?.(); });
}
