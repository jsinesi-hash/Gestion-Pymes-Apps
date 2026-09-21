import { describe, it, expect, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { marcaCreateHandler, marcaUpdateHandler } from '../marca';

describe('marca validación (ADR-082)', () => {
  afterEach(() => clearSession());

  it('rechaza nombre vacío con VALIDATION:nombre:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => marcaCreateHandler(db, { nombre: '' } as any)).toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('rechaza nombre de tipo equivocado con VALIDATION:nombre:TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => marcaCreateHandler(db, { nombre: 123 } as any)).toThrow(/VALIDATION:nombre:TIPO/);
  });

  it('acepta payload válido (happy path intacto)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = marcaCreateHandler(db, { nombre: 'Stanley' } as any);
    expect(row.nombre).toBe('Stanley');
  });

  it('update rechaza nombre vacío cuando se envía', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = marcaCreateHandler(db, { nombre: 'Stanley' } as any);
    expect(() => marcaUpdateHandler(db, { id: row.id, nombre: '' } as any))
      .toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('update acepta cambio válido de nombre', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = marcaCreateHandler(db, { nombre: 'Stanley' } as any);
    const upd = marcaUpdateHandler(db, { id: row.id, nombre: 'Bahco' } as any);
    expect(upd.nombre).toBe('Bahco');
  });
});
