export interface EstadoActualizacion {
  estado: 'idle' | 'available' | 'downloaded' | 'error';
  version: string | null;
  mensaje: string | null;
}

interface AutoUpdaterLike {
  logger: unknown;
  on(evento: string, cb: (arg: any) => void): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
}

let _estado: EstadoActualizacion = { estado: 'idle', version: null, mensaje: null };
let _autoUpdater: AutoUpdaterLike | null = null;

export function obtenerEstado(): EstadoActualizacion {
  return { ..._estado };
}

export function marcarDisponible(version: string): void {
  _estado = { estado: 'available', version, mensaje: null };
}

export function marcarDescargado(version: string): void {
  _estado = { estado: 'downloaded', version, mensaje: null };
}

export function marcarError(mensaje: string): void {
  _estado = { estado: 'error', version: null, mensaje };
}

/** Solo para tests: vuelve el módulo a estado inicial. */
export function _resetEstado(): void {
  _estado = { estado: 'idle', version: null, mensaje: null };
  _autoUpdater = null;
}

/**
 * Wira electron-updater y dispara la verificación/descarga en background,
 * en silencio (sin notificación nativa del SO): la propuesta se muestra
 * in-app al login del Supervisor. No hace nada si la app no está
 * empaquetada (dev/tests).
 */
export async function iniciarActualizador(
  app: { isPackaged: boolean },
  deps?: { autoUpdater?: AutoUpdaterLike },
): Promise<void> {
  if (!app.isPackaged) return;
  if (_autoUpdater) return; // ya inicializado: evita listeners duplicados
  const autoUpdater = deps?.autoUpdater ?? (await import('electron-updater')).autoUpdater as unknown as AutoUpdaterLike;
  _autoUpdater = autoUpdater;

  autoUpdater.logger = {
    info:  (msg: string) => console.log('[updater]', msg),
    warn:  (msg: string) => console.warn('[updater]', msg),
    error: (msg: string) => console.error('[updater]', msg),
    debug: (_msg: string) => {},
    transports: { file: null },
  };

  autoUpdater.on('update-available', (info: { version: string }) => marcarDisponible(info?.version ?? ''));
  autoUpdater.on('update-downloaded', (info: { version: string }) => marcarDescargado(info?.version ?? ''));
  autoUpdater.on('error', (err: Error) => marcarError(err?.message ?? 'error desconocido'));

  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    marcarError((e as Error)?.message ?? 'no se pudo verificar actualización');
  }
}

/** Cierra la app, instala la actualización descargada y reabre. */
export function instalarYReiniciar(): void {
  _autoUpdater?.quitAndInstall();
}
