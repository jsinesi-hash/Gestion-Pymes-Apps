import { describe, it, expect, beforeEach } from 'vitest';
import { requireSession } from './guard';
import { setSession, clearSession } from './session';

// Revisión 2026-10-20 (P2): `requireSession` estaba copiada 23 veces (12 en Elaborados, 8 en
// Retail y 3 en el núcleo, con forma idéntica salvo una que lanzaba otro código). Ahora es una
// sola función del núcleo.
describe('requireSession', () => {
  beforeEach(() => clearSession());

  it('sin sesión lanza UNAUTHENTICATED', () => {
    expect(() => requireSession()).toThrow('UNAUTHENTICATED');
  });

  it('con sesión devuelve la sesión activa (userId, rolId y permisos)', () => {
    const sesion = { userId: 'u1', rolId: 'r1', permisos: new Set(['venta.crear']) };
    setSession(sesion, { id: 'u1', nombreCompleto: 'U', rolId: 'r1', rolNombre: 'OPERADOR', permisos: ['venta.crear'], preferencias: {} } as never);
    const r = requireSession();
    expect(r.userId).toBe('u1');
    expect(r.permisos.has('venta.crear')).toBe(true);
  });

  it('tras cerrar la sesión vuelve a lanzar', () => {
    setSession({ userId: 'u1', rolId: 'r1', permisos: new Set() }, { id: 'u1' } as never);
    clearSession();
    expect(() => requireSession()).toThrow('UNAUTHENTICATED');
  });
});
