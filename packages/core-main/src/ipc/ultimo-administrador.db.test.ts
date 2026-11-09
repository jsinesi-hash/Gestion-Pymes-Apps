import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb, loginAsAdmin, clearSession } from '../testing/helpers';
import { desactivarUsuarioHandler, usuarioUpdateHandler, hashPassword } from '../index';

// ADR-146: nunca puede quedar el sistema sin un usuario activo que administre usuarios. La regla
// mira el permiso `usuario.administrar` (no el nombre del rol) y vale también al cambiar de rol.
describe('último administrador de usuarios', () => {
  let db: ReturnType<typeof setupCoreDb>;
  const rolId = (nombre: string) =>
    db.select({ id: schema.rol.id }).from(schema.rol).where(eq(schema.rol.nombre, nombre)).get()!.id;
  const adminId = () =>
    db.select({ id: schema.usuario.id }).from(schema.usuario).where(eq(schema.usuario.nombre_usuario, 'admin')).get()!.id;

  function crearUsuario(nombre: string, rol: string) {
    const now = new Date();
    db.insert(schema.usuario).values({
      id: `u-${nombre}`, nombre_usuario: nombre, nombre_completo: nombre, email: `${nombre}@prueba.local`,
      hash_password: hashPassword('clave1234'), rol_id: rolId(rol), activo: true, password_changed_at: now,
      usuario_creacion_id: 'system', fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    return `u-${nombre}`;
  }

  function darPermiso(rol: string, codigo: string) {
    const permiso = db.select({ id: schema.permiso.id }).from(schema.permiso).where(eq(schema.permiso.codigo, codigo)).get()!;
    db.insert(schema.rol_permiso).values({
      id: `rp-${rol}-${codigo}`, rol_id: rolId(rol), permiso_id: permiso.id,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();
  }

  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
  });

  it('no se puede pasar al único administrador a un rol sin usuario.administrar', () => {
    const otroAdmin = crearUsuario('sup2', 'SUPERVISOR');
    loginAsAdmin(db);
    // Con dos administradores, uno puede cambiar de rol.
    usuarioUpdateHandler(db, { id: otroAdmin, rol_id: rolId('OPERADOR') });
    // Ahora `admin` es el único: cambiarle el rol dejaría el sistema sin administración.
    expect(() => usuarioUpdateHandler(db, { id: adminId(), rol_id: rolId('OPERADOR') })).toThrow('LAST_SUPERVISOR');
    const admin = db.select().from(schema.usuario).where(eq(schema.usuario.id, adminId())).get()!;
    expect(admin.rol_id).toBe(rolId('SUPERVISOR'));
  });

  it('cambiar datos del único administrador sin tocar el rol sigue permitido', () => {
    loginAsAdmin(db);
    expect(() => usuarioUpdateHandler(db, { id: adminId(), nombre_completo: 'Otro nombre' })).not.toThrow();
  });

  it('la regla mira el permiso: si otro rol administra usuarios, el Supervisor se puede desactivar', () => {
    darPermiso('OPERADOR', 'usuario.administrar');
    crearUsuario('encargado', 'OPERADOR');
    const sup2 = crearUsuario('sup2', 'SUPERVISOR');
    loginAsAdmin(db);
    desactivarUsuarioHandler(db, { userId: sup2 });
    const fila = db.select().from(schema.usuario).where(eq(schema.usuario.id, sup2)).get()!;
    expect(fila.activo).toBe(false);
  });

  it('un Supervisor que no es el último administrador se puede desactivar aunque sea el último SUPERVISOR', () => {
    darPermiso('OPERADOR', 'usuario.administrar');
    crearUsuario('encargado', 'OPERADOR');
    const sup2 = crearUsuario('sup2', 'SUPERVISOR');
    loginAsAdmin(db);
    // `admin` queda inactivo (la sesión sigue abierta en memoria): sup2 es el último SUPERVISOR,
    // pero `encargado` administra usuarios. La regla vieja (por nombre de rol) lo impedía.
    db.update(schema.usuario).set({ activo: false }).where(eq(schema.usuario.id, adminId())).run();
    desactivarUsuarioHandler(db, { userId: sup2 });
    expect(db.select().from(schema.usuario).where(eq(schema.usuario.id, sup2)).get()!.activo).toBe(false);
  });

  it('desactivar al último usuario activo con usuario.administrar sigue prohibido', () => {
    const op = crearUsuario('operador1', 'OPERADOR');
    darPermiso('OPERADOR', 'usuario.administrar');
    loginAsAdmin(db);
    // Hay dos administradores (admin y operador1): desactivar a operador1 está bien.
    desactivarUsuarioHandler(db, { userId: op });
    // `admin` quedó como único administrador.
    expect(() => desactivarUsuarioHandler(db, { userId: adminId() })).toThrow('LAST_SUPERVISOR');
  });
});
