import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { invalidateCachedParametro } from '../parametros-cache';
import { smtpGetConfigHandler, smtpSetConfigHandler } from '../smtp';

describe('smtp handlers', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); clearSession(); invalidateCachedParametro(); });

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
