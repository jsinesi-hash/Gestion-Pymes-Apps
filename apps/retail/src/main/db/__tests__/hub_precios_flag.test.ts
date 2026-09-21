import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

describe('ADR-078 — hub_precios_habilitado encendido de fábrica (migración 0043)', () => {
  it('queda en "true" tras migrar', () => {
    const db = createTestDb();
    const row = db
      .select()
      .from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'hub_precios_habilitado'))
      .get();
    expect(row?.valor).toBe('true');
  });
});
