import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb, loginAsAdmin, loginAsOperador, clearSession } from '../testing/helpers';
import { permisoActualizarRolHandler, permisoMatrizHandler, getSession, getSessionData, hashPassword } from '../index';
import { runSeed } from '../auth/seed';

// ADR-147 — Editor de permisos por rol (PERF-3 opción B).
describe('permisoActualizarRolHandler', () => {
  let db: ReturnType<typeof setupCoreDb>;
  const rolId = (nombre: string) =>
    db.select({ id: schema.rol.id }).from(schema.rol).where(eq(schema.rol.nombre, nombre)).get()!.id;
  const codigosDe = (rol: string) => permisoMatrizHandler(db).porRol[rolId(rol)].slice().sort();
  const overrides = (rol: string) => db.select({ otorgado: schema.rol_permiso_override.otorgado, codigo: schema.permiso.codigo })
    .from(schema.rol_permiso_override)
    .innerJoin(schema.permiso, eq(schema.permiso.id, schema.rol_permiso_override.permiso_id))
    .where(eq(schema.rol_permiso_override.rol_id, rolId(rol))).all();

  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
    loginAsAdmin(db);
  });

  it('exige usuario.administrar', () => {
    loginAsOperador(db);
    expect(() => permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: [] })).toThrow('FORBIDDEN');
  });

  it('quita y agrega permisos a un rol y deja registrado el cambio', () => {
    const antes = codigosDe('OPERADOR');
    const nuevos = [...antes.filter(c => c !== 'ctacte.cobrar'), 'dashboard.ver'];
    permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: nuevos });
    expect(codigosDe('OPERADOR')).toEqual(nuevos.slice().sort());
    expect(overrides('OPERADOR').sort((a, b) => a.codigo.localeCompare(b.codigo))).toEqual([
      { codigo: 'ctacte.cobrar', otorgado: false },
      { codigo: 'dashboard.ver', otorgado: true },
    ]);
  });

  it('el cambio sobrevive al seed del próximo arranque', () => {
    const nuevos = codigosDe('OPERADOR').filter(c => c !== 'ctacte.cobrar');
    permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: nuevos });
    runSeed(db, { permisos: [], operador: [] });
    expect(codigosDe('OPERADOR')).not.toContain('ctacte.cobrar');
  });

  it('volver a otorgar un permiso revocado reemplaza la revocación (una fila por rol y permiso)', () => {
    const op = rolId('OPERADOR');
    const base = codigosDe('OPERADOR');
    permisoActualizarRolHandler(db, { rolId: op, permisos: base.filter(c => c !== 'ctacte.cobrar') });
    permisoActualizarRolHandler(db, { rolId: op, permisos: base });
    expect(codigosDe('OPERADOR')).toContain('ctacte.cobrar');
    expect(overrides('OPERADOR')).toEqual([{ codigo: 'ctacte.cobrar', otorgado: true }]);
  });

  it('rechaza un código de permiso que no existe sin tocar nada', () => {
    const antes = codigosDe('OPERADOR');
    expect(() => permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: [...antes, 'no.existe'] }))
      .toThrow('PERMISO_DESCONOCIDO');
    expect(codigosDe('OPERADOR')).toEqual(antes);
  });

  it('no deja quitarle usuario.administrar al propio rol', () => {
    const sinAdmin = codigosDe('SUPERVISOR').filter(c => c !== 'usuario.administrar');
    expect(() => permisoActualizarRolHandler(db, { rolId: rolId('SUPERVISOR'), permisos: sinAdmin }))
      .toThrow('PERMISO_PROPIO_ADMIN');
    expect(codigosDe('SUPERVISOR')).toContain('usuario.administrar');
  });

  it('no deja quitarle usuario.administrar a un rol si sus usuarios son los únicos administradores activos', () => {
    // Rol extra con usuario.administrar y un usuario activo; el admin (Supervisor) queda inactivo.
    const now = new Date();
    db.insert(schema.rol).values({
      id: 'rol-enc', nombre: 'ENCARGADO', es_sistema: false, activo: true,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    permisoActualizarRolHandler(db, { rolId: 'rol-enc', permisos: ['usuario.administrar'] });
    db.insert(schema.usuario).values({
      id: 'u-enc', nombre_usuario: 'encargado', nombre_completo: 'Encargado', email: 'e@prueba.local',
      hash_password: hashPassword('clave1234'), rol_id: 'rol-enc', activo: true, password_changed_at: now,
      usuario_creacion_id: 'system', fecha_creacion: now, version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    db.update(schema.usuario).set({ activo: false }).where(eq(schema.usuario.nombre_usuario, 'admin')).run();
    expect(() => permisoActualizarRolHandler(db, { rolId: 'rol-enc', permisos: [] })).toThrow('SIN_ADMINISTRADOR');
  });

  it('quitarle usuario.administrar a otro rol está bien mientras quede un administrador activo', () => {
    const op = rolId('OPERADOR');
    permisoActualizarRolHandler(db, { rolId: op, permisos: [...codigosDe('OPERADOR'), 'usuario.administrar'] });
    const sinAdmin = codigosDe('OPERADOR').filter(c => c !== 'usuario.administrar');
    expect(() => permisoActualizarRolHandler(db, { rolId: op, permisos: sinAdmin })).not.toThrow();
    expect(codigosDe('OPERADOR')).not.toContain('usuario.administrar');
  });

  it('si edito mi propio rol, mi sesión toma los permisos nuevos al instante', () => {
    const sinDashboard = codigosDe('SUPERVISOR').filter(c => c !== 'dashboard.ver');
    permisoActualizarRolHandler(db, { rolId: rolId('SUPERVISOR'), permisos: sinDashboard });
    expect(getSession()!.permisos.has('dashboard.ver')).toBe(false);
    expect(getSessionData()!.permisos).not.toContain('dashboard.ver');
  });

  it('editar otro rol no toca la sesión actual', () => {
    const antes = [...getSession()!.permisos].sort();
    permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: [] });
    expect([...getSession()!.permisos].sort()).toEqual(antes);
  });

  it('un rol inexistente o inactivo da NOT_FOUND', () => {
    expect(() => permisoActualizarRolHandler(db, { rolId: 'no-existe', permisos: [] })).toThrow('NOT_FOUND');
    db.update(schema.rol).set({ activo: false }).where(eq(schema.rol.nombre, 'OPERADOR')).run();
    expect(() => permisoActualizarRolHandler(db, { rolId: rolId('OPERADOR'), permisos: [] })).toThrow('NOT_FOUND');
  });
});
