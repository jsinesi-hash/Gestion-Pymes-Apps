import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, clearSession, loginAsAdmin } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { impuestoListHandler } from '@core/main';

describe('impuesto handlers', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); runCatalogSeed(db); clearSession(); });

  // Revisión 2026-10-20 (P2): era el único canal de lectura del catálogo que respondía sin sesión.
  it('sin sesión rechaza con UNAUTHENTICATED', () => {
    expect(() => impuestoListHandler(db)).toThrow('UNAUTHENTICATED');
  });

  it('lista impuestos activos', () => {
    loginAsAdmin(db);
    expect(impuestoListHandler(db)).toHaveLength(3);
    expect(impuestoListHandler(db).map(i => i.nombre)).toContain('IVA 21%');
  });
});
