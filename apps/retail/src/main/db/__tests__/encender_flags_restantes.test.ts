import { describe, it, expect } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

describe('ADR-061/078 — flags restantes encendidos (migración 0044)', () => {
  it('busqueda_similares/sinonimos/sustitutos quedan en "true" tras migrar', () => {
    const db = createTestDb();
    const rows = db.select().from(schema.parametros_sistema)
      .where(inArray(schema.parametros_sistema.clave,
        ['busqueda_similares_habilitado', 'sinonimos_habilitado', 'sustitutos_habilitado'])).all();
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.valor).toBe('true');
  });
});
