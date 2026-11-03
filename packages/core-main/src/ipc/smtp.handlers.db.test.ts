import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '@core/db';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { invalidateCachedParametro } from '../index';
import type { IpcMain } from 'electron';
import { registerCoreHandlers } from '../registrar';
import { smtpGetConfigHandler, smtpSetConfigHandler } from './smtp';

// ADR-142: los handlers del SMTP viven en el núcleo. `parametrosSetHandler` solo actualiza filas que ya
// existen: cada app siembra las claves `smtp_*` con una migración (Retail 0027, Elaborados 0013). El
// esquema que genera el helper de tests del núcleo no trae filas, así que se declaran acá, iguales.
const CLAVES_SMTP = [
  { clave: 'smtp_host', valor: '', tipo: 'string' as const, descripcion: 'Host del servidor SMTP para envio de emails.' },
  { clave: 'smtp_port', valor: '587', tipo: 'number' as const, descripcion: 'Puerto SMTP (587 STARTTLS, 465 SSL).' },
  { clave: 'smtp_secure', valor: 'false', tipo: 'bool' as const, descripcion: 'true = TLS directa (465); false = STARTTLS (587).' },
  { clave: 'smtp_from', valor: '', tipo: 'string' as const, descripcion: 'Direccion remitente de los emails (From).' },
  { clave: 'smtp_user', valor: '', tipo: 'string' as const, descripcion: 'Usuario de autenticacion SMTP.' },
];

describe('smtp handlers', () => {
  let db: ReturnType<typeof setupCoreDb>;
  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
    invalidateCachedParametro();
    db.insert(schema.parametros_sistema).values(CLAVES_SMTP).run();
  });

  it('getConfig no devuelve la contraseña, solo tiene_password', () => {
    loginAsAdmin(db);
    const cfg = smtpGetConfigHandler(db, { tienePassword: () => true });
    expect(cfg).not.toHaveProperty('password');
    expect(cfg.tiene_password).toBe(true);
    expect(cfg.port).toBe(587);
  });

  it('setConfig persiste host/port/secure/from/user (guard Supervisor)', () => {
    loginAsAdmin(db);
    smtpSetConfigHandler(db, { host: 'smtp.x', port: 465, secure: true, from: 'a@x', user: 'u' });
    const cfg = smtpGetConfigHandler(db, { tienePassword: () => false });
    expect(cfg.host).toBe('smtp.x');
    expect(cfg.port).toBe(465);
    expect(cfg.secure).toBe(true);
    expect(cfg.from).toBe('a@x');
    expect(cfg.user).toBe('u');
    expect(cfg.tiene_password).toBe(false);
  });

  it('setConfig sin sesión Supervisor lanza FORBIDDEN', () => {
    expect(() => smtpSetConfigHandler(db, { host: 'x', port: 25, secure: false, from: 'a', user: 'u' })).toThrow('FORBIDDEN');
  });
});

// ADR-142: `registerCoreHandlers` usa por defecto el enviador SMTP real: la recuperación de contraseña
// (ADR-137) solo se ofrece cuando un Supervisor configuró el servidor, igual en todas las apps.
describe('recuperación de contraseña con el SMTP real por defecto', () => {
  it('sin servidor SMTP configurado no está disponible (y no toca safeStorage)', async () => {
    const db = setupCoreDb();
    clearSession();
    invalidateCachedParametro();
    db.insert(schema.parametros_sistema).values(CLAVES_SMTP).run();
    const handlers = new Map<string, (...a: any[]) => unknown>();
    const ipcMain = { handle: (c: string, h: (...a: any[]) => unknown) => { handlers.set(c, h); }, on: () => {} } as unknown as IpcMain;
    registerCoreHandlers(ipcMain, db, { migrationsFolder: 'migraciones', navegacion: {} as never });
    expect(await handlers.get('auth:recuperacionDisponible')!({})).toBe(false);
  });
});
