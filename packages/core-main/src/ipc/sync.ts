// Canales de Configuración → Sincronización (F2 PR4). Universales: cada app inyecta su esquema, su
// registro de sync y sus proyecciones por `registerCoreHandlers({ sync })`; las políticas están en
// `politicas-core.ts` (ver el estado: sesión; el resto: administración de usuarios).
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { IpcMain } from 'electron';
import { crearBackup } from '../backup/engine';
import { getModoTerminal, getOriginId } from '../context';
import type { DbSync } from '../sync/cliente';
import { crearSyncTerminal, type DepsSyncTerminal, type EstadoTerminalSync, type OpcionesSyncTerminal, type SyncTerminal } from '../sync/terminal-sync';

let instancia: SyncTerminal | null = null;

/** La instancia de la app (null si la app no configuró el sync). */
export function syncTerminalActiva(): SyncTerminal | null {
  return instancia;
}

/** Al arrancar la app, después de `registerCoreHandlers`: en modo distribuido enciende el cliente. */
export function iniciarSyncTerminal(): boolean {
  return instancia?.iniciar() ?? false;
}

function depsElectron(db: DbSync, o: OpcionesSyncTerminal): DepsSyncTerminal {
  return {
    safeStorage,
    async respaldar() {
      const destino = path.join(o.carpetaDatos, 'backups', 'pre-sync');
      fs.mkdirSync(destino, { recursive: true });
      return crearBackup({
        db: db as never, destino, tipo: 'auto', incluirCerts: false, appVersion: app.getVersion(), sucursalId: getOriginId(),
      });
    },
    log: (m) => console.log(m),
  };
}

function requerir(): SyncTerminal {
  if (!instancia) throw new Error('SYNC_NO_CONFIGURADO');
  return instancia;
}

export function registerSyncHandlers(ipcMain: IpcMain, db: DbSync, o?: OpcionesSyncTerminal, deps?: DepsSyncTerminal): void {
  if (o) {
    instancia?.detener();
    instancia = crearSyncTerminal(db, o, deps ?? depsElectron(db, o));
  }
  ipcMain.handle('sync:estado', async (): Promise<EstadoTerminalSync> =>
    instancia?.estado() ?? { modo: getModoTerminal(), origin_id: getOriginId(), hub: null, sync: null });
  ipcMain.handle('sync:sondear', async (_e, p: { url: string }) => requerir().sondear(String(p?.url ?? '')));
  ipcMain.handle('sync:emparejar', async (_e, p: { url: string; codigo: string; huella: string; nombre?: string }) =>
    requerir().emparejar({
      url: String(p?.url ?? ''), codigo: String(p?.codigo ?? ''), huella: String(p?.huella ?? ''),
      ...(typeof p?.nombre === 'string' ? { nombre: p.nombre } : {}),
    }));
  ipcMain.handle('sync:sincronizar', async () => requerir().sincronizarAhora());
  ipcMain.handle('sync:desemparejar', async (_e, p?: { forzar?: boolean }) => requerir().desemparejar({ forzar: p?.forzar === true }));
  ipcMain.handle('sync:rebajarSnapshot', async (_e, p?: { forzar?: boolean }) => requerir().rebajarSnapshot({ forzar: p?.forzar === true }));
}
