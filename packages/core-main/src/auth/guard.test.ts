import { describe, it, expect, beforeEach } from 'vitest';
import { requirePermission, requirePermiso } from './guard';
import { setSession, clearSession } from './session';

const SESSION_WITH_PERM = {
  userId: 'u1',
  rolId: 'r1',
  permisos: new Set(['venta.crear']),
};

const SESSION_DATA = {
  id: 'u1',
  nombreCompleto: 'Admin',
  rolId: 'r1',
  rolNombre: '',
  passwordDiasRestantes: 30,
  permisos: ['venta.crear'],
  preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] },
};

describe('requirePermiso', () => {
  beforeEach(() => clearSession());

  it('devuelve la sesión cuando tiene el permiso', () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    expect(requirePermiso('venta.crear').userId).toBe('u1');
  });

  it('lanza un Error FORBIDDEN:<codigo> cuando falta el permiso', () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    // ADR-145: siempre `Error` (un objeto plano llega al renderer como "[object Object]").
    expect(() => requirePermiso('venta.anular')).toThrow(new Error('FORBIDDEN:venta.anular'));
  });

  it('lanza un Error UNAUTHENTICATED sin sesión', () => {
    expect(() => requirePermiso('venta.crear')).toThrow(new Error('UNAUTHENTICATED'));
  });
});

describe('requirePermission', () => {
  beforeEach(() => clearSession());

  it('ejecuta el handler cuando la sesión tiene el permiso requerido', async () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    const handler = requirePermission('venta.crear')(async (_event: unknown) => 'resultado');
    expect(await handler(null, 'arg1')).toBe('resultado');
  });

  it('rechaza con un Error FORBIDDEN cuando la sesión no tiene el permiso', async () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    const handler = requirePermission('venta.anular')(async (_event: unknown) => 'no debería llegar');
    const err = await handler(null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('FORBIDDEN:venta.anular');
  });

  it('rechaza con un Error UNAUTHENTICATED cuando no hay sesión activa', async () => {
    const handler = requirePermission('venta.crear')(async (_event: unknown) => 'no debería llegar');
    await expect(handler(null)).rejects.toThrow(new Error('UNAUTHENTICATED'));
  });

  it('un handler sincrónico que lanza también llega como rechazo', async () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    const handler = requirePermission('venta.crear')((() => { throw new Error('X'); }) as never);
    await expect(handler(null)).rejects.toThrow('X');
  });
});
