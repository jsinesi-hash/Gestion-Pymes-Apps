import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { permisoMatrizHandler } from '@core/main';
import { PERMISOS, OPERADOR_PERMISOS } from '../../auth/seed';

describe('permisoMatrizHandler (ADR-087)', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    clearSession();
    db = setupDb();
  });

  it('rechaza sin sesión / sin permiso usuario.administrar', () => {
    // sin login → sin sesión
    expect(() => permisoMatrizHandler(db)).toThrow('FORBIDDEN');
  });

  it('devuelve roles, permisos y asignaciones por rol', () => {
    loginAsAdmin(db);
    const m = permisoMatrizHandler(db);

    // roles: OPERADOR + SUPERVISOR (activos)
    const nombres = m.roles.map(r => r.nombre).sort();
    expect(nombres).toEqual(['OPERADOR', 'SUPERVISOR']);

    // permisos: los 29 del seed, con codigo/descripcion/modulo
    expect(m.permisos.length).toBe(PERMISOS.length);
    const codigos = m.permisos.map(p => p.codigo).sort();
    expect(codigos).toEqual(PERMISOS.map(p => p.codigo).sort());
    expect(m.permisos.every(p => 'modulo' in p)).toBe(true);

    // porRol: Supervisor tiene todos; Operador tiene exactamente OPERADOR_PERMISOS
    const sup = m.roles.find(r => r.nombre === 'SUPERVISOR')!;
    const op = m.roles.find(r => r.nombre === 'OPERADOR')!;
    expect(m.porRol[sup.id].length).toBe(PERMISOS.length);
    expect([...m.porRol[op.id]].sort()).toEqual([...OPERADOR_PERMISOS].sort());
  });

  it('el Operador tiene venta.crear pero no venta.anular', () => {
    loginAsAdmin(db);
    const m = permisoMatrizHandler(db);
    const op = m.roles.find(r => r.nombre === 'OPERADOR')!;
    expect(m.porRol[op.id]).toContain('venta.crear');
    expect(m.porRol[op.id]).not.toContain('venta.anular');
  });
});
