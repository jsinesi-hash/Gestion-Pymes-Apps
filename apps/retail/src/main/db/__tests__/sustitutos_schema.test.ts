import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';

describe('esquema sustitutos (migración 0036)', () => {
  it('producto tiene la columna discontinuado', () => {
    const db = createTestDb();
    const cols = db.all(sql`PRAGMA table_info(producto)`) as { name: string }[];
    expect(cols.some(c => c.name === 'discontinuado')).toBe(true);
  });

  it('existe la tabla producto_equivalencia', () => {
    const db = createTestDb();
    const t = db.get(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='producto_equivalencia'`);
    expect(t).toBeTruthy();
  });

  it('siembra el flag sustitutos_habilitado (0036; encendido de fábrica por 0044/ADR-061)', () => {
    const db = createTestDb();
    const f = db.get(sql`SELECT valor FROM parametros_sistema WHERE clave='sustitutos_habilitado'`) as { valor: string } | undefined;
    // 0036 lo sembró en 'false'; 0044 (ADR-061) lo flipeó a 'true'.
    expect(f?.valor).toBe('true');
  });
});
