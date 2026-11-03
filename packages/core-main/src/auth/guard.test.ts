import { describe, it, expect, beforeEach } from 'vitest';
import { requirePermission } from './guard';
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

describe('requirePermission', () => {
  beforeEach(() => {
    clearSession();
  });

  it('ejecuta el handler cuando la sesión tiene el permiso requerido', async () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    const handler = requirePermission('venta.crear')(
      async (_event: unknown) => 'resultado'
    );
    const result = await handler(null, 'arg1');
    expect(result).toBe('resultado');
  });

  it('lanza FORBIDDEN cuando la sesión no tiene el permiso', async () => {
    setSession(SESSION_WITH_PERM, SESSION_DATA);
    const handler = requirePermission('venta.anular')(
      async (_event: unknown) => 'no debería llegar'
    );
    await expect(handler(null)).rejects.toMatchObject({ code: 'FORBIDDEN', permiso: 'venta.anular' });
  });

  it('lanza UNAUTHENTICATED cuando no hay sesión activa', async () => {
    const handler = requirePermission('venta.crear')(
      async (_event: unknown) => 'no debería llegar'
    );
    await expect(handler(null)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
