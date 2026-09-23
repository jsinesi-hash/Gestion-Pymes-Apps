import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb, setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';
import { parametrosListFlagsHandler } from '@core/main';

afterEach(() => clearSession());

describe('migración 0047 — flag vistos_recientes (ADR-081 / PERF-2)', () => {
  it('siembra el flag vistos_recientes_habilitado en false', () => {
    const db = createTestDb();
    const params = db.select().from(schema.parametros_sistema).all();
    const row = params.find((p) => p.clave === 'vistos_recientes_habilitado');
    expect(row?.valor).toBe('false');
    expect(row?.tipo).toBe('bool');
  });

  it('el flag aparece en listFlags (auto-descubierto por Funcionalidades)', () => {
    const db = setupDb();
    loginAsAdmin(db);
    const flags = parametrosListFlagsHandler(db);
    expect(flags.map((f) => f.clave)).toContain('vistos_recientes_habilitado');
  });
});
