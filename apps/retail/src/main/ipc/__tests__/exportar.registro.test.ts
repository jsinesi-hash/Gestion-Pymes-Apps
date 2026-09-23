import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { crearExportarEjecutar, EXPORTADORES_CORE, type Exportador } from '@core/main';
import { setupDb, loginAsAdmin, clearSession } from './helpers';

const fake: Exportador = {
  definicion: { entidad: 'fake', label: 'Fake', permiso: 'export.basico',
    perfiles: [{ id: 'basico', label: 'B', permiso: 'export.basico', columnas: [{ campo: 'a', label: 'A' }] }] },
  fetch: () => [{ a: 1 }],
};

describe('crearExportarEjecutar', () => {
  beforeEach(() => clearSession());
  it('el core registra clientes, caja y ctacte', () => {
    expect(EXPORTADORES_CORE.map(e => e.definicion.entidad).sort()).toEqual(['caja', 'clientes', 'ctacte']);
  });
  it('ejecuta un exportador de app registrado', async () => {
    const db = setupDb(); loginAsAdmin(db);
    const ejecutar = crearExportarEjecutar([...EXPORTADORES_CORE, fake]);
    const f = path.join(os.tmpdir(), `exp-${Date.now()}.csv`);
    await ejecutar(db, { entidad: 'fake', perfilId: 'basico', formato: 'csv', alcance: 'todo' }, f);
    expect(fs.readFileSync(f, 'utf8')).toContain('A');
  });
  it('entidad no registrada → ENTIDAD_DESCONOCIDA', async () => {
    const db = setupDb(); loginAsAdmin(db);
    await expect(crearExportarEjecutar(EXPORTADORES_CORE)(db,
      { entidad: 'productos', perfilId: 'x', formato: 'csv', alcance: 'todo' }, 'x.csv'))
      .rejects.toThrow('ENTIDAD_DESCONOCIDA');
  });
  it('clave duplicada → error al crear', () => {
    expect(() => crearExportarEjecutar([fake, fake])).toThrow('EXPORTADOR_DUPLICADO');
  });
});
