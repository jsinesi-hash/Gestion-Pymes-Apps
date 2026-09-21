import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

type ColInfo = { name: string; notnull: number; dflt_value: string | null };

describe('migración 0046 — inicio personalizable (ADR-080)', () => {
  it('usuario_preferencias tiene columnas pantalla_inicio y favoritos', () => {
    const db = createTestDb();
    const cols = db.all(sql`PRAGMA table_info('usuario_preferencias')`) as ColInfo[];
    const names = cols.map((c) => c.name);
    expect(names).toContain('pantalla_inicio');
    expect(names).toContain('favoritos');
  });

  it('favoritos es NOT NULL con default "[]" y pantalla_inicio es nullable', () => {
    const db = createTestDb();
    const cols = db.all(sql`PRAGMA table_info('usuario_preferencias')`) as ColInfo[];
    const fav = cols.find((c) => c.name === 'favoritos')!;
    const pant = cols.find((c) => c.name === 'pantalla_inicio')!;
    expect(fav.notnull).toBe(1);
    expect(String(fav.dflt_value)).toContain('[]');
    expect(pant.notnull).toBe(0);
  });

  it('siembra el flag inicio_personalizable_habilitado en false', () => {
    const db = createTestDb();
    const params = db.select().from(schema.parametros_sistema).all();
    const row = params.find((p) => p.clave === 'inicio_personalizable_habilitado');
    expect(row?.valor).toBe('false');
    expect(row?.tipo).toBe('bool');
  });
});
