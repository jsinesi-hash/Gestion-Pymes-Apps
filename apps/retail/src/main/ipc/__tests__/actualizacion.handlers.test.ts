import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  notasPostUpdateHandler, marcarVersionVistaHandler, estadoHandler,
} from '../actualizacion';
import { _resetEstado, marcarDescargado } from '../../actualizacion/estado';

const appFake = { getVersion: () => '1.1.0' };

describe('actualizacion handlers', () => {
  beforeEach(() => { clearSession(); _resetEstado(); });

  it('estadoHandler devuelve el estado actual con sesión', () => {
    const db = setupDb();
    loginAsAdmin(db);
    marcarDescargado('1.1.0');
    expect(estadoHandler().estado).toBe('downloaded');
  });

  it('estadoHandler sin sesión lanza FORBIDDEN', () => {
    expect(() => estadoHandler()).toThrow('FORBIDDEN');
  });

  it('notasPostUpdate devuelve notas cuando no hay versión vista', () => {
    const db = setupDb();
    loginAsAdmin(db);
    const r = notasPostUpdateHandler(db, appFake);
    expect(r).not.toBeNull();
    expect(r!.version).toBe('1.1.0');
    expect(r!.notas.length).toBeGreaterThan(0);
  });

  it('notasPostUpdate devuelve null tras marcar la versión como vista', () => {
    const db = setupDb();
    loginAsAdmin(db);
    marcarVersionVistaHandler(db, appFake);
    expect(notasPostUpdateHandler(db, appFake)).toBeNull();
  });

  it('notasPostUpdate devuelve null si la versión no está en el changelog', () => {
    const db = setupDb();
    loginAsAdmin(db);
    expect(notasPostUpdateHandler(db, { getVersion: () => '0.0.1' })).toBeNull();
  });

  it('marcarVersionVista es idempotente (upsert): segunda llamada no rompe', () => {
    const db = setupDb();
    loginAsAdmin(db);
    marcarVersionVistaHandler(db, appFake);
    marcarVersionVistaHandler(db, appFake);
    expect(notasPostUpdateHandler(db, appFake)).toBeNull();
  });
});
