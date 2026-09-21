import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { runSinonimoSeed } from '../seed';
import { SINONIMO_GRUPOS } from '../dataset';
import { normalizarTermino } from '../normalizar';

describe('normalizarTermino', () => {
  it('minúsculas, sin acentos, sin puntuación, espacios colapsados', () => {
    expect(normalizarTermino('Llave Inglesa')).toBe('llave inglesa');
    expect(normalizarTermino('  CAÑO   3/4"  ')).toBe('cano 3 4');
    expect(normalizarTermino('Lámpara')).toBe('lampara');
    expect(normalizarTermino('destornillador—phillips')).toBe('destornillador phillips');
  });
});

describe('runSinonimoSeed (ADR-067)', () => {
  it('crea la tabla sinonimo vía migración y arranca vacía', () => {
    const db = createTestDb();
    expect(db.select().from(schema.sinonimo).all().length).toBe(0);
  });

  it('siembra un grupo por cada entrada del dataset con su canónico', () => {
    const db = createTestDb();
    runSinonimoSeed(db);

    const filas = db.select().from(schema.sinonimo).all();
    // Un grupo_id distinto por grupo del dataset.
    const grupos = new Set(filas.map(f => f.grupo_id));
    expect(grupos.size).toBe(SINONIMO_GRUPOS.length);

    // Exactamente un canónico por grupo.
    for (const gid of grupos) {
      const canonicos = filas.filter(f => f.grupo_id === gid && f.es_canonico);
      expect(canonicos.length).toBe(1);
    }

    // Todas las filas de seed llevan origen='seed' y termino_norm normalizado.
    for (const f of filas) {
      expect(f.origen).toBe('seed');
      expect(f.termino_norm).toBe(normalizarTermino(f.termino));
    }
  });

  it('el grupo del canónico "alicate" contiene a "pinza"', () => {
    const db = createTestDb();
    runSinonimoSeed(db);
    const alicate = db.select().from(schema.sinonimo)
      .where(eq(schema.sinonimo.termino_norm, 'alicate')).get()!;
    const hermanos = db.select().from(schema.sinonimo)
      .where(eq(schema.sinonimo.grupo_id, alicate.grupo_id)).all()
      .map(f => f.termino_norm);
    expect(hermanos).toContain('pinza');
  });

  it('es idempotente — segunda corrida no duplica', () => {
    const db = createTestDb();
    runSinonimoSeed(db);
    const n1 = db.select().from(schema.sinonimo).all().length;
    runSinonimoSeed(db);
    const n2 = db.select().from(schema.sinonimo).all().length;
    expect(n2).toBe(n1);
  });

  it('siembra el flag sinonimos_habilitado (migración 0037; encendido de fábrica por 0044/ADR-061)', () => {
    const db = createTestDb();
    const flag = db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'sinonimos_habilitado')).get();
    // 0037 lo sembró en 'false'; 0044 (ADR-061) lo flipeó a 'true' junto con el resto.
    expect(flag?.valor).toBe('true');
  });
});
