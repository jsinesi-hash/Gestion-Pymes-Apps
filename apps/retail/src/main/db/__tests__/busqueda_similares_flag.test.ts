import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

describe('flag busqueda_similares_habilitado (búsqueda por similitud en Catálogo)', () => {
  it('queda en "true" tras migrar (0041 lo sembró false; 0044/ADR-061 lo encendió de fábrica)', () => {
    const db = createTestDb();
    const flag = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'busqueda_similares_habilitado')).get();
    expect(flag, 'falta el flag busqueda_similares_habilitado').toBeDefined();
    expect(flag?.valor).toBe('true');
    expect(flag?.tipo).toBe('bool');
  });
});
