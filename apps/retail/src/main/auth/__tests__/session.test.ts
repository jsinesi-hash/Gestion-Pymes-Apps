import { describe, it, expect, beforeEach } from 'vitest';
import { getSession, getSessionData, setSession, clearSession } from '../session';
import type { CurrentSession, SessionData } from '../session';

const mockSession: CurrentSession = {
  userId: 'u1',
  rolId: 'r1',
  permisos: new Set(['venta.crear', 'caja.operar']),
};

const mockData: SessionData = {
  id: 'u1',
  nombreCompleto: 'Juan Pérez',
  rolId: 'r1',
  rolNombre: 'Admin',
  permisos: ['venta.crear', 'caja.operar'],
  preferencias: {
    tema: 'claro',
    acento: 'amber',
    ui_font: 'Hanken Grotesk',
    densidad: 'comfortable',
    skin: 'actual',
    pantalla_inicio: null,
    favoritos: [],
  },
};

describe('session module', () => {
  beforeEach(() => {
    clearSession();
  });

  it('getSession retorna null antes de setSession', () => {
    expect(getSession()).toBeNull();
  });

  it('getSessionData retorna null antes de setSession', () => {
    expect(getSessionData()).toBeNull();
  });

  it('setSession persiste; getSession y getSessionData retornan los valores', () => {
    setSession(mockSession, mockData);
    expect(getSession()).toBe(mockSession);
    expect(getSessionData()).toBe(mockData);
  });

  it('clearSession deja getSession en null', () => {
    setSession(mockSession, mockData);
    clearSession();
    expect(getSession()).toBeNull();
    expect(getSessionData()).toBeNull();
  });
});
