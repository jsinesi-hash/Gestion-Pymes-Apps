import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { runSeed, PERMISOS_CORE, OPERADOR_PERMISOS_CORE } from '@core/main';
import { PERMISOS, OPERADOR_PERMISOS } from '../seed';
import { createTestDb } from '../../ipc/__tests__/helpers';

function permisosDeRol(db: ReturnType<typeof createTestDb>, rol: string): string[] {
  const r = db.select().from(schema.rol).where(eq(schema.rol.nombre, rol)).get()!;
  return db.select({ c: schema.permiso.codigo }).from(schema.rol_permiso)
    .innerJoin(schema.permiso, eq(schema.permiso.id, schema.rol_permiso.permiso_id))
    .where(eq(schema.rol_permiso.rol_id, r.id)).all().map(x => x.c).sort();
}

describe('runSeed (core) con permisos inyectados', () => {
  it('sin permisos de app siembra solo los del core', () => {
    const db = createTestDb();
    runSeed(db, { permisos: [], operador: [] });
    expect(permisosDeRol(db, 'SUPERVISOR')).toEqual(PERMISOS_CORE.map(p => p.codigo).sort());
    expect(permisosDeRol(db, 'OPERADOR')).toEqual([...OPERADOR_PERMISOS_CORE].sort());
  });
  it('une core + app sin duplicar (Retail = mismo resultado que antes)', () => {
    const db = createTestDb();
    runSeed(db, { permisos: PERMISOS, operador: [...OPERADOR_PERMISOS] });
    expect(permisosDeRol(db, 'SUPERVISOR')).toEqual([...new Set(PERMISOS.map(p => p.codigo))].sort());
    expect(permisosDeRol(db, 'OPERADOR')).toEqual([...OPERADOR_PERMISOS].sort());
  });
  it('los permisos del core están todos en la lista de Retail', () => {
    const retail = new Set(PERMISOS.map(p => p.codigo));
    for (const p of PERMISOS_CORE) expect(retail.has(p.codigo)).toBe(true);
    for (const c of OPERADOR_PERMISOS_CORE) expect(OPERADOR_PERMISOS.has(c)).toBe(true);
  });
  it('es idempotente', () => {
    const db = createTestDb();
    runSeed(db, { permisos: [], operador: [] });
    runSeed(db, { permisos: [], operador: [] });
    expect(db.select().from(schema.usuario).all()).toHaveLength(1);
  });
});
