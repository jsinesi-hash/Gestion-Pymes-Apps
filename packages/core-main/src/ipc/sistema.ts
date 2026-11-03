import type { IpcMain } from 'electron';
import { requireSession } from '../auth/guard';
import { registroErrores, type ErrorRegistrado } from '../registro-errores';

// Consulta del registro de errores del sistema (ADR-140): errores de los jobs programados y errores
// no capturados del proceso main. Solo Supervisor: usa el permiso de la pantalla donde se muestra
// (Backup y restauración).

function requireSupervisor(): void {
  const session = requireSession();
  if (!session.permisos.has('backup.crear')) throw new Error('FORBIDDEN');
}

export function erroresListarHandler(): ErrorRegistrado[] {
  requireSupervisor();
  return registroErrores.listar();
}

export function erroresLimpiarHandler(): { ok: true } {
  requireSupervisor();
  registroErrores.limpiar();
  return { ok: true };
}

export function registerSistemaHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('sistema:erroresListar', async () => erroresListarHandler());
  ipcMain.handle('sistema:erroresLimpiar', async () => erroresLimpiarHandler());
}
