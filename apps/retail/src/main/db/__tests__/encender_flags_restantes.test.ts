import { describe, it, expect } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';
import { listarParametros } from '@core/main';

describe('ADR-061/078 — flags restantes encendidos (migración 0044)', () => {
  it('busqueda_similares/sinonimos/sustitutos quedan en "true" tras migrar', () => {
    const db = createTestDb();
    const rows = listarParametros(db).filter((p) => ['busqueda_similares_habilitado', 'sinonimos_habilitado', 'sustitutos_habilitado'].includes(p.clave));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.valor).toBe('true');
  });
});
