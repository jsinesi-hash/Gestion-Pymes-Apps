import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';
import { listarParametros } from '@core/main';

describe('ADR-078 — hub_precios_habilitado encendido de fábrica (migración 0043)', () => {
  it('queda en "true" tras migrar', () => {
    const db = createTestDb();
    const row = listarParametros(db).find((p) => p.clave === 'hub_precios_habilitado');
    expect(row?.valor).toBe('true');
  });
});
