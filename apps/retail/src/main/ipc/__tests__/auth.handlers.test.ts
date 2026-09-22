import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { verificarSupervisor } from '@core/main';

describe('verificarSupervisor', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  it('no lanza cuando usuario es SUPERVISOR con password correcta', () => {
    expect(() =>
      verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' })
    ).not.toThrow();
  });

  it('retorna el userId del supervisor', () => {
    const userId = verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' });
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  });

  it('lanza SUPERVISOR_INVALIDO con password incorrecta', () => {
    expect(() =>
      verificarSupervisor(db, { nombre_usuario: 'admin', password: 'wrongpass' })
    ).toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO con usuario inexistente', () => {
    expect(() =>
      verificarSupervisor(db, { nombre_usuario: 'noexiste', password: 'admin1234' })
    ).toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO si el usuario no es SUPERVISOR', () => {
    loginAsAdmin(db);
    const rolOperador = db.select({ id: schema.rol.id }).from(schema.rol)
      .where(eq(schema.rol.nombre, 'OPERADOR')).get()!;
    const now = new Date();
    db.insert(schema.usuario).values({
      id: 'op-test-001', nombre_usuario: 'operador1', nombre_completo: 'Op Test',
      hash_password: 'hash', rol_id: rolOperador.id, activo: true,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    clearSession();
    expect(() =>
      verificarSupervisor(db, { nombre_usuario: 'operador1', password: 'admin1234' })
    ).toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO si el usuario está inactivo', () => {
    db.update(schema.usuario).set({ activo: false })
      .where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    expect(() =>
      verificarSupervisor(db, { nombre_usuario: 'admin', password: 'admin1234' })
    ).toThrow('SUPERVISOR_INVALIDO');
  });
});
