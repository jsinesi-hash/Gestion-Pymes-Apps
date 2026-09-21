import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, clearSession } from './helpers';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('seed — permisos de export', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); clearSession(); });

  function getPermisosDelRol(rolNombre: string): string[] {
    const rol = db.select({ id: schema.rol.id })
      .from(schema.rol).where(eq(schema.rol.nombre, rolNombre)).get()!;
    return db.select({ codigo: schema.permiso.codigo })
      .from(schema.permiso)
      .innerJoin(schema.rol_permiso, eq(schema.rol_permiso.permiso_id, schema.permiso.id))
      .where(eq(schema.rol_permiso.rol_id, rol.id))
      .all().map(r => r.codigo);
  }

  it('OPERADOR tiene export.basico', () => {
    expect(getPermisosDelRol('OPERADOR')).toContain('export.basico');
  });
  it('OPERADOR NO tiene export.supervisor', () => {
    expect(getPermisosDelRol('OPERADOR')).not.toContain('export.supervisor');
  });
  it('SUPERVISOR tiene export.basico y export.supervisor', () => {
    const permisos = getPermisosDelRol('SUPERVISOR');
    expect(permisos).toContain('export.basico');
    expect(permisos).toContain('export.supervisor');
  });
});
