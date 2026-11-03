import { describe, it, expect } from 'vitest';
import { setupCoreDb, loginAsAdmin } from './helpers';
import { getSession, clearSession } from '../auth/session';

// Valida la infraestructura de tests con BD del núcleo (esquema generado desde Drizzle, sin
// migraciones de app): el seed corre y el login funciona.
// El admin del seed es SUPERVISOR y trae los permisos universales (los de Retail/Elaborados se suman en la app).
describe('BD de pruebas del núcleo', () => {
  it('siembra el admin y permite iniciar sesión', () => {
    clearSession();
    const db = setupCoreDb();
    const s = loginAsAdmin(db);
    expect(s.rolNombre).toBe('SUPERVISOR');
    expect(s.permisos).toContain('venta.crear');
    expect(getSession()).not.toBeNull();
  });
});
