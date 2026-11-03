import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { setSession, clearSession, type SessionData } from '../auth/session';
import { registroErrores } from '../registro-errores';
import { erroresListarHandler, erroresLimpiarHandler, registerSistemaHandlers } from './sistema';

// ADR-140: el registro de errores del sistema lo consulta un Supervisor desde Backup y restauración.
// Mismo permiso que esa pantalla (`backup.crear`): solo Supervisor.
function conSesion(permisos: string[]) {
  const data: SessionData = {
    id: 'u1', nombreCompleto: 'Prueba', rolId: 'r1', rolNombre: 'X', permisos, passwordDiasRestantes: 30,
    preferencias: {
      tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual',
      pantalla_inicio: null, favoritos: [],
    },
  };
  setSession({ userId: 'u1', rolId: 'r1', permisos: new Set(permisos) }, data);
}

beforeEach(() => {
  clearSession();
  registroErrores.limpiar();
});
afterEach(() => {
  clearSession();
  registroErrores.limpiar();
});

describe('erroresListarHandler', () => {
  it('sin sesión lanza UNAUTHENTICATED', () => {
    expect(() => erroresListarHandler()).toThrow('UNAUTHENTICATED');
  });

  it('un usuario sin el permiso de backup recibe FORBIDDEN', () => {
    conSesion(['venta.crear']);
    expect(() => erroresListarHandler()).toThrow('FORBIDDEN');
  });

  it('un Supervisor ve los errores, del más reciente al más viejo', () => {
    registroErrores.registrar('tarea:avisos-reintentos', new Error('uno'));
    registroErrores.registrar('main:uncaughtException', new Error('dos'));
    conSesion(['backup.crear']);
    expect(erroresListarHandler().map((e) => e.mensaje)).toEqual(['dos', 'uno']);
  });

  it('sin errores devuelve una lista vacía', () => {
    conSesion(['backup.crear']);
    expect(erroresListarHandler()).toEqual([]);
  });
});

describe('erroresLimpiarHandler', () => {
  it('sin sesión lanza UNAUTHENTICATED y no borra nada', () => {
    registroErrores.registrar('t', new Error('x'));
    expect(() => erroresLimpiarHandler()).toThrow('UNAUTHENTICATED');
    expect(registroErrores.listar()).toHaveLength(1);
  });

  it('sin el permiso de backup recibe FORBIDDEN y no borra nada', () => {
    registroErrores.registrar('t', new Error('x'));
    conSesion(['venta.crear']);
    expect(() => erroresLimpiarHandler()).toThrow('FORBIDDEN');
    expect(registroErrores.listar()).toHaveLength(1);
  });

  it('un Supervisor vacía el registro', () => {
    registroErrores.registrar('t', new Error('x'));
    conSesion(['backup.crear']);
    expect(erroresLimpiarHandler()).toEqual({ ok: true });
    expect(registroErrores.listar()).toEqual([]);
  });
});

describe('registerSistemaHandlers', () => {
  it('registra los dos canales', () => {
    const canales: string[] = [];
    const ipcMain = { handle: (c: string) => { canales.push(c); } } as unknown as IpcMain;
    registerSistemaHandlers(ipcMain);
    expect(canales.sort()).toEqual(['sistema:erroresLimpiar', 'sistema:erroresListar']);
  });

  it('los canales delegan en los handlers (y por lo tanto exigen sesión)', async () => {
    const handlers = new Map<string, () => unknown>();
    const ipcMain = { handle: (c: string, h: () => unknown) => { handlers.set(c, h); } } as unknown as IpcMain;
    registerSistemaHandlers(ipcMain);
    await expect(Promise.resolve().then(() => handlers.get('sistema:erroresListar')!())).rejects.toThrow('UNAUTHENTICATED');
    conSesion(['backup.crear']);
    registroErrores.registrar('t', new Error('visible'));
    const lista = (await handlers.get('sistema:erroresListar')!()) as Array<{ mensaje: string }>;
    expect(lista.map((e) => e.mensaje)).toEqual(['visible']);
    vi.restoreAllMocks();
  });
});
