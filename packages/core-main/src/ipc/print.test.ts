import { describe, it, expect, vi } from 'vitest';
import { crearImpresorHtml } from './print';

function ventanaFalsa(resultado: { ok: boolean; reason?: string }) {
  const win = {
    loadURL: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    webContents: { print: vi.fn((_o: unknown, cb: (ok: boolean, reason: string) => void) => cb(resultado.ok, resultado.reason ?? '')) },
  };
  return win;
}

describe('crearImpresorHtml', () => {
  it('carga el HTML como data URL, imprime y cierra la ventana', async () => {
    const win = ventanaFalsa({ ok: true });
    await crearImpresorHtml(() => win as never)('<p>hola ñ</p>');
    expect(win.loadURL).toHaveBeenCalledWith(`data:text/html;charset=utf-8,${encodeURIComponent('<p>hola ñ</p>')}`);
    expect(win.webContents.print).toHaveBeenCalledWith({ silent: false }, expect.any(Function));
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it('rechaza con el motivo si el usuario cancela, y cierra igual', async () => {
    const win = ventanaFalsa({ ok: false, reason: 'cancelled' });
    await expect(crearImpresorHtml(() => win as never)('<p>x</p>')).rejects.toThrow('cancelled');
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it('cierra la ventana y propaga el error si loadURL rechaza', async () => {
    const win = ventanaFalsa({ ok: true });
    win.loadURL.mockRejectedValue(new Error('ERR_FAILED'));
    await expect(crearImpresorHtml(() => win as never)('<p>x</p>')).rejects.toThrow('ERR_FAILED');
    expect(win.close).toHaveBeenCalledTimes(1);
    expect(win.webContents.print).not.toHaveBeenCalled();
  });
});
