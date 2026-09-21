import { describe, it, expect, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { unidadCreateHandler, unidadUpdateHandler } from '../unidad';

describe('unidad validación (ADR-082)', () => {
  afterEach(() => clearSession());

  it('rechaza nombre vacío con VALIDATION:nombre:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => unidadCreateHandler(db, { nombre: '', abreviatura: 'un' } as any))
      .toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('rechaza abreviatura vacía con VALIDATION:abreviatura:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => unidadCreateHandler(db, { nombre: 'Unidad', abreviatura: '' } as any))
      .toThrow(/VALIDATION:abreviatura:REQUERIDO/);
  });

  it('rechaza nombre de tipo equivocado con VALIDATION:nombre:TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => unidadCreateHandler(db, { nombre: 123, abreviatura: 'un' } as any))
      .toThrow(/VALIDATION:nombre:TIPO/);
  });

  it('acepta payload válido (happy path intacto)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = unidadCreateHandler(db, { nombre: 'Kilogramo', abreviatura: 'kg' } as any);
    expect(row.nombre).toBe('Kilogramo');
    expect(row.abreviatura).toBe('kg');
  });

  it('update rechaza abreviatura vacía cuando se envía', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = unidadCreateHandler(db, { nombre: 'Kilogramo', abreviatura: 'kg' } as any);
    expect(() => unidadUpdateHandler(db, { id: row.id, abreviatura: '' } as any))
      .toThrow(/VALIDATION:abreviatura:REQUERIDO/);
  });

  it('update acepta cambio válido de nombre', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = unidadCreateHandler(db, { nombre: 'Kilogramo', abreviatura: 'kg' } as any);
    const upd = unidadUpdateHandler(db, { id: row.id, nombre: 'Gramo' } as any);
    expect(upd.nombre).toBe('Gramo');
  });
});
