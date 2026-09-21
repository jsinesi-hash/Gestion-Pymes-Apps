import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  obtenerEstado, marcarDisponible, marcarDescargado, marcarError,
  _resetEstado, iniciarActualizador, instalarYReiniciar,
} from '../estado';

function fakeUpdater() {
  const listeners: Record<string, (arg: any) => void> = {};
  return {
    logger: null as any,
    on: vi.fn((ev: string, cb: (arg: any) => void) => { listeners[ev] = cb; }),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    _emit: (ev: string, arg?: any) => listeners[ev]?.(arg),
  };
}

describe('estado del actualizador', () => {
  beforeEach(() => _resetEstado());

  it('arranca en idle', () => {
    expect(obtenerEstado()).toEqual({ estado: 'idle', version: null, mensaje: null });
  });

  it('marcarDisponible y marcarDescargado actualizan estado y versión', () => {
    marcarDisponible('1.2.0');
    expect(obtenerEstado()).toEqual({ estado: 'available', version: '1.2.0', mensaje: null });
    marcarDescargado('1.2.0');
    expect(obtenerEstado()).toEqual({ estado: 'downloaded', version: '1.2.0', mensaje: null });
  });

  it('marcarError setea estado error con mensaje', () => {
    marcarError('sin red');
    expect(obtenerEstado()).toEqual({ estado: 'error', version: null, mensaje: 'sin red' });
  });

  it('en app NO empaquetada no toca el updater y queda idle', async () => {
    const up = fakeUpdater();
    await iniciarActualizador({ isPackaged: false }, { autoUpdater: up as any });
    expect(up.on).not.toHaveBeenCalled();
    expect(up.checkForUpdates).not.toHaveBeenCalled();
    expect(obtenerEstado().estado).toBe('idle');
  });

  it('en app empaquetada registra listeners, chequea, y el evento downloaded actualiza estado', async () => {
    const up = fakeUpdater();
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    expect(up.checkForUpdates).toHaveBeenCalledTimes(1);
    up._emit('update-downloaded', { version: '2.0.0' });
    expect(obtenerEstado()).toEqual({ estado: 'downloaded', version: '2.0.0', mensaje: null });
  });

  it('instalarYReiniciar delega en quitAndInstall del updater inicializado', async () => {
    const up = fakeUpdater();
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    instalarYReiniciar();
    expect(up.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('iniciarActualizador es idempotente: segunda llamada no re-registra ni re-chequea', async () => {
    const up = fakeUpdater();
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    expect(up.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('si checkForUpdates rechaza, el estado pasa a error con el mensaje', async () => {
    const up = fakeUpdater();
    up.checkForUpdates = vi.fn().mockRejectedValue(new Error('sin red'));
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    expect(obtenerEstado()).toEqual({ estado: 'error', version: null, mensaje: 'sin red' });
  });

  it('el evento error del updater setea estado error', async () => {
    const up = fakeUpdater();
    await iniciarActualizador({ isPackaged: true }, { autoUpdater: up as any });
    up._emit('error', new Error('boom'));
    expect(obtenerEstado()).toEqual({ estado: 'error', version: null, mensaje: 'boom' });
  });
});
