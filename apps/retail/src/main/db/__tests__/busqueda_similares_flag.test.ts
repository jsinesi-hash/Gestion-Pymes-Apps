import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';
import { listarParametros } from '@core/main';

describe('flag busqueda_similares_habilitado (búsqueda por similitud en Catálogo)', () => {
  it('queda en "true" tras migrar (0041 lo sembró false; 0044/ADR-061 lo encendió de fábrica)', () => {
    const db = createTestDb();
    const flag = listarParametros(db).find((p) => p.clave === 'busqueda_similares_habilitado');
    expect(flag, 'falta el flag busqueda_similares_habilitado').toBeDefined();
    expect(flag?.valor).toBe('true');
    expect(flag?.tipo).toBe('bool');
  });
});
