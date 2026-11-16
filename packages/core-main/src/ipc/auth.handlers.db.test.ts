import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb, clearSession } from '../testing/helpers';
import { verificarAutorizacion, hashPassword } from '../index';

// ADR-146: la autorización (anular, override de precio, cierre con diferencia, exceso de crédito)
// la da quien tenga el permiso de la acción, no quien sea del rol SUPERVISOR.
describe('verificarAutorizacion', () => {
  let db: ReturnType<typeof setupCoreDb>;

  function crearUsuario(nombre: string, rolNombre: string, opts: { activo?: boolean } = {}) {
    const rol = db.select({ id: schema.rol.id }).from(schema.rol).where(eq(schema.rol.nombre, rolNombre)).get()!;
    const now = new Date();
    db.insert(schema.usuario).values({
      id: `u-${nombre}`, nombre_usuario: nombre, nombre_completo: nombre,
      hash_password: hashPassword('clave1234'), rol_id: rol.id, activo: opts.activo ?? true,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    return rol.id;
  }

  function darPermiso(rolId: string, codigo: string) {
    const permiso = db.select({ id: schema.permiso.id }).from(schema.permiso).where(eq(schema.permiso.codigo, codigo)).get()!;
    const now = new Date();
    db.insert(schema.rol_permiso).values({
      id: `rp-${rolId}-${codigo}`, rol_id: rolId, permiso_id: permiso.id,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
  }

  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
  });

  it('devuelve el id de un usuario cuyo rol tiene el permiso', () => {
    const userId = verificarAutorizacion(db, { nombre_usuario: 'admin', password: 'admin1234' }, 'venta.anular');
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  });

  it('lanza SUPERVISOR_INVALIDO con password incorrecta', () => {
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'admin', password: 'wrongpass' }, 'venta.anular'))
      .toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO con usuario inexistente', () => {
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'noexiste', password: 'admin1234' }, 'venta.anular'))
      .toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO si el rol del usuario no tiene el permiso, aunque la clave sea correcta', () => {
    crearUsuario('operador1', 'OPERADOR');
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'operador1', password: 'clave1234' }, 'venta.anular'))
      .toThrow('SUPERVISOR_INVALIDO');
  });

  it('autoriza a un usuario que no es SUPERVISOR si su rol tiene el permiso de la acción', () => {
    const rolId = crearUsuario('operador1', 'OPERADOR');
    darPermiso(rolId, 'venta.anular');
    expect(verificarAutorizacion(db, { nombre_usuario: 'operador1', password: 'clave1234' }, 'venta.anular'))
      .toBe('u-operador1');
  });

  it('el permiso es el de la acción: tener otro no alcanza', () => {
    const rolId = crearUsuario('operador1', 'OPERADOR');
    darPermiso(rolId, 'venta.anular');
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'operador1', password: 'clave1234' }, 'precio.override'))
      .toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO si el usuario está inactivo', () => {
    db.update(schema.usuario).set({ activo: false })
      .where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'admin', password: 'admin1234' }, 'venta.anular'))
      .toThrow('SUPERVISOR_INVALIDO');
  });

  it('lanza SUPERVISOR_INVALIDO si el rol está inactivo', () => {
    db.update(schema.rol).set({ activo: false }).where(eq(schema.rol.nombre, 'SUPERVISOR')).run();
    expect(() => verificarAutorizacion(db, { nombre_usuario: 'admin', password: 'admin1234' }, 'venta.anular'))
      .toThrow('SUPERVISOR_INVALIDO');
  });
});
