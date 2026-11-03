import { describe, it, expect, beforeEach } from 'vitest';
import type { IpcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import * as schema from '../../db/schema';
import { invalidateCachedParametro, registerCoreHandlers, smtpGetConfigHandler, smtpSetConfigHandler } from '@core/main';

// ADR-143: Elaborados recibe el correo saliente (SMTP) que ya tenía Retail, y con él la recuperación de
// contraseña. `parametrosSetHandler` solo ACTUALIZA filas que ya existen: la migración 0013 siembra las
// claves `smtp_*`; sin ella, guardar la configuración no persistía nada y no daba error.
let db: ReturnType<typeof setupDb>;

const CLAVES = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_from', 'smtp_user'];
const filaDe = (clave: string) =>
  db.select().from(schema.parametros_sistema).where(eq(schema.parametros_sistema.clave, clave)).get();

beforeEach(() => {
  db = setupDb();
  clearSession();
  invalidateCachedParametro();
});

describe('migración 0013: claves smtp_* en Elaborados', () => {
  it('siembra las cinco claves', () => {
    for (const c of CLAVES) expect(filaDe(c), c).toBeDefined();
  });

  it('con los valores por defecto: sin servidor, puerto 587 y sin TLS directa', () => {
    expect(filaDe('smtp_host')!.valor).toBe('');
    expect(filaDe('smtp_port')!.valor).toBe('587');
    expect(filaDe('smtp_secure')!.valor).toBe('false');
    expect(filaDe('smtp_from')!.valor).toBe('');
    expect(filaDe('smtp_user')!.valor).toBe('');
  });

  it('con el tipo y una descripción de cada una', () => {
    expect(filaDe('smtp_port')!.tipo).toBe('number');
    expect(filaDe('smtp_secure')!.tipo).toBe('bool');
    expect(filaDe('smtp_host')!.tipo).toBe('string');
    for (const c of CLAVES) expect(filaDe(c)!.descripcion, c).toBeTruthy();
  });
});

describe('configuración del SMTP en Elaborados', () => {
  it('getConfig devuelve los valores por defecto y nunca la contraseña', () => {
    const cfg = smtpGetConfigHandler(db, { tienePassword: () => false });
    expect(cfg).toEqual({ host: '', port: 587, secure: false, from: '', user: '', tiene_password: false });
    expect(cfg).not.toHaveProperty('password');
  });

  it('un Supervisor guarda la configuración y queda persistida en la base de Elaborados', () => {
    loginAsAdmin(db);
    smtpSetConfigHandler(db, { host: 'smtp.ejemplo.com', port: 465, secure: true, from: 'heladeria@ejemplo.com', user: 'heladeria@ejemplo.com' });
    invalidateCachedParametro();
    expect(smtpGetConfigHandler(db, { tienePassword: () => true })).toEqual({
      host: 'smtp.ejemplo.com', port: 465, secure: true, from: 'heladeria@ejemplo.com', user: 'heladeria@ejemplo.com', tiene_password: true,
    });
    expect(filaDe('smtp_host')!.valor).toBe('smtp.ejemplo.com');
  });

  it('sin sesión de Supervisor no se puede cambiar', () => {
    expect(() => smtpSetConfigHandler(db, { host: 'x', port: 25, secure: false, from: 'a', user: 'u' })).toThrow('FORBIDDEN');
    expect(filaDe('smtp_host')!.valor).toBe('');
  });
});

describe('recuperación de contraseña en Elaborados', () => {
  function registrar() {
    const handlers = new Map<string, (...a: any[]) => unknown>();
    const ipcMain = { handle: (c: string, h: (...a: any[]) => unknown) => { handlers.set(c, h); }, on: () => {} } as unknown as IpcMain;
    registerCoreHandlers(ipcMain, db, { migrationsFolder: 'migraciones', navegacion: {} as never });
    return handlers;
  }

  it('la app expone los canales del SMTP y de la recuperación', () => {
    const h = registrar();
    for (const c of ['smtp:getConfig', 'smtp:setConfig', 'smtp:setPassword', 'smtp:probar', 'auth:recuperacionDisponible', 'auth:recuperarSolicitar', 'auth:recuperarConfirmar']) {
      expect(h.has(c), c).toBe(true);
    }
  });

  it('mientras no haya SMTP configurado la recuperación no se ofrece (el login no muestra el enlace)', async () => {
    expect(await registrar().get('auth:recuperacionDisponible')!({})).toBe(false);
  });
});
