import { describe, it, expect, beforeEach } from 'vitest';
import { ipcConPoliticas, type PoliticasCanales } from './politicas-canales';
import { setSession, clearSession } from './session';

type Fn = (e: unknown, ...a: unknown[]) => unknown;

function ipcFalso() {
  const canales = new Map<string, Fn>();
  return {
    canales,
    ipc: { handle: (c: string, fn: Fn) => { canales.set(c, fn); } },
  };
}

const DATOS = {
  id: 'u1', nombreCompleto: 'U', rolId: 'r', rolNombre: 'R', permisos: [], passwordDiasRestantes: 30,
  preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] },
};
const conPermisos = (...p: string[]) => setSession({ userId: 'u1', rolId: 'r', permisos: new Set(p) }, DATOS);

const POLITICAS: PoliticasCanales = {
  'x:publico': 'publico',
  'x:sesion': 'sesion',
  'x:permiso': 'permiso:producto.editar',
};

describe('ipcConPoliticas (ADR-145)', () => {
  beforeEach(() => clearSession());

  it('un canal sin política no se registra: falla al arrancar', () => {
    const { ipc } = ipcFalso();
    const guardado = ipcConPoliticas(ipc as never, POLITICAS);
    expect(() => guardado.handle('x:desconocido', async () => 1)).toThrow('CANAL_SIN_POLITICA:x:desconocido');
  });

  it('publico: responde sin sesión', async () => {
    const { ipc, canales } = ipcFalso();
    ipcConPoliticas(ipc as never, POLITICAS).handle('x:publico', async () => 'ok');
    expect(await canales.get('x:publico')!(null)).toBe('ok');
  });

  it('sesion: exige sesión pero ningún permiso', async () => {
    const { ipc, canales } = ipcFalso();
    ipcConPoliticas(ipc as never, POLITICAS).handle('x:sesion', async () => 'ok');
    await expect(Promise.resolve().then(() => canales.get('x:sesion')!(null))).rejects.toThrow('UNAUTHENTICATED');
    conPermisos();
    expect(await canales.get('x:sesion')!(null)).toBe('ok');
  });

  it('permiso: exige el permiso declarado y pasa los argumentos', async () => {
    const { ipc, canales } = ipcFalso();
    ipcConPoliticas(ipc as never, POLITICAS).handle('x:permiso', (_e, a, b) => `${a}-${b}`);
    conPermisos('venta.crear');
    await expect(Promise.resolve().then(() => canales.get('x:permiso')!(null, 1, 2))).rejects.toThrow('FORBIDDEN:producto.editar');
    conPermisos('producto.editar');
    expect(await canales.get('x:permiso')!(null, 1, 2)).toBe('1-2');
  });

  it('el guard corre antes que el handler (sin efectos si se rechaza)', async () => {
    const { ipc, canales } = ipcFalso();
    let llamado = false;
    ipcConPoliticas(ipc as never, POLITICAS).handle('x:permiso', () => { llamado = true; });
    await Promise.resolve().then(() => canales.get('x:permiso')!(null)).catch(() => undefined);
    expect(llamado).toBe(false);
  });

  it('deja pasar el resto de la API de ipcMain (on, removeHandler)', () => {
    let on = 0;
    const base = { handle: () => undefined, on: () => { on++; } };
    const guardado = ipcConPoliticas(base as never, POLITICAS);
    (guardado as unknown as { on: () => void }).on();
    expect(on).toBe(1);
  });
});
