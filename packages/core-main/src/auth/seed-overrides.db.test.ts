import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb } from '../testing/helpers';
import { runSeed } from './seed';

// ADR-147: runSeed corre en cada arranque y es aditivo. Sin esta regla, un permiso que un
// administrador le quitó a un rol desde «Roles y permisos» volvería solo al reiniciar la app.
describe('runSeed respeta los cambios hechos desde Roles y permisos', () => {
  let db: ReturnType<typeof setupCoreDb>;
  const rolId = (nombre: string) =>
    db.select({ id: schema.rol.id }).from(schema.rol).where(eq(schema.rol.nombre, nombre)).get()!.id;
  const permisoId = (codigo: string) =>
    db.select({ id: schema.permiso.id }).from(schema.permiso).where(eq(schema.permiso.codigo, codigo)).get()!.id;
  const filas = (rol: string, codigo: string) => db.select({ id: schema.rol_permiso.id, deleted_at: schema.rol_permiso.deleted_at })
    .from(schema.rol_permiso)
    .where(and(eq(schema.rol_permiso.rol_id, rolId(rol)), eq(schema.rol_permiso.permiso_id, permisoId(codigo)))).all();
  const tiene = (rol: string, codigo: string) => filas(rol, codigo).some((f) => f.deleted_at === null);

  function override(rol: string, codigo: string, otorgado: boolean) {
    const now = new Date();
    db.insert(schema.rol_permiso_override).values({
      id: `ov-${rol}-${codigo}`, rol_id: rolId(rol), permiso_id: permisoId(codigo), otorgado,
      fecha_actualizacion: now, version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
  }
  // Quitar un permiso deja lápida (ADR-150 §7), como hace «Roles y permisos».
  function quitar(rol: string, codigo: string) {
    db.update(schema.rol_permiso).set({ deleted_at: new Date() })
      .where(and(
        eq(schema.rol_permiso.rol_id, rolId(rol)),
        eq(schema.rol_permiso.permiso_id, permisoId(codigo)),
        isNull(schema.rol_permiso.deleted_at),
      )).run();
  }
  const reseed = () => runSeed(db, { permisos: [], operador: [] });

  beforeEach(() => { db = setupCoreDb(); });

  it('un permiso revocado a un rol no vuelve al reiniciar', () => {
    quitar('OPERADOR', 'ctacte.cobrar');
    override('OPERADOR', 'ctacte.cobrar', false);
    reseed();
    expect(tiene('OPERADOR', 'ctacte.cobrar')).toBe(false);
  });

  it('la revocación es por rol: el mismo permiso sigue en los demás roles', () => {
    quitar('OPERADOR', 'ctacte.cobrar');
    override('OPERADOR', 'ctacte.cobrar', false);
    reseed();
    expect(tiene('SUPERVISOR', 'ctacte.cobrar')).toBe(true);
  });

  it('un permiso de fábrica que falta sin revocación se vuelve a otorgar (sigue siendo aditivo)', () => {
    quitar('OPERADOR', 'caja.operar');
    reseed();
    expect(tiene('OPERADOR', 'caja.operar')).toBe(true);
  });

  it('al volver a otorgarlo revive la misma fila: no duplica', () => {
    quitar('OPERADOR', 'caja.operar');
    reseed();
    expect(filas('OPERADOR', 'caja.operar')).toHaveLength(1);
  });

  it('un permiso agregado a mano a un rol se conserva al reiniciar', () => {
    db.insert(schema.rol_permiso).values({
      id: 'rp-extra', rol_id: rolId('OPERADOR'), permiso_id: permisoId('dashboard.ver'),
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();
    override('OPERADOR', 'dashboard.ver', true);
    reseed();
    expect(tiene('OPERADOR', 'dashboard.ver')).toBe(true);
  });

  it('un permiso agregado a mano que falta se repone (el override otorgado manda)', () => {
    override('OPERADOR', 'dashboard.ver', true);
    reseed();
    expect(tiene('OPERADOR', 'dashboard.ver')).toBe(true);
  });
});
