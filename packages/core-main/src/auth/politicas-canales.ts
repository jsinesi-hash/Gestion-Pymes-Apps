import type { IpcMain } from 'electron';
import { requirePermiso, requireSession } from './guard';

/**
 * Qué exige cada canal IPC (ADR-145):
 * - `publico`: responde sin sesión (login y pasos previos a abrirla).
 * - `sesion`: exige sesión, ningún permiso (lecturas de uso general, datos propios).
 * - `permiso:<codigo>`: exige ese permiso.
 */
export type PoliticaCanal = 'publico' | 'sesion' | `permiso:${string}`;
export type PoliticasCanales = Readonly<Record<string, PoliticaCanal>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (event: any, ...args: any[]) => unknown;

function exigir(politica: PoliticaCanal): void {
  if (politica === 'publico') return;
  if (politica === 'sesion') { requireSession(); return; }
  requirePermiso(politica.slice('permiso:'.length));
}

/**
 * Devuelve un `ipcMain` que antepone a cada handler el guard de su política. Un canal que no está
 * en la tabla no se registra: lanza `CANAL_SIN_POLITICA` al arrancar (falla cerrado). Los handlers
 * conservan sus propios chequeos; esta capa garantiza el mínimo para todos los canales.
 */
export function ipcConPoliticas(ipcMain: IpcMain, politicas: PoliticasCanales): IpcMain {
  const handle = (canal: string, fn: Handler): void => {
    const politica = politicas[canal];
    if (!politica) throw new Error(`CANAL_SIN_POLITICA:${canal}`);
    ipcMain.handle(canal, async (event, ...args) => {
      exigir(politica);
      return fn(event, ...args);
    });
  };
  return new Proxy(ipcMain, {
    get(target, prop, receiver) {
      if (prop === 'handle') return handle;
      const valor = Reflect.get(target, prop, receiver);
      return typeof valor === 'function' ? valor.bind(target) : valor;
    },
  });
}
