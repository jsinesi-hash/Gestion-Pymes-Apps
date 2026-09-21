import { describe, it, expect, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { categoriaCreateHandler, categoriaUpdateHandler } from '../categoria';

describe('categoria validación (ADR-082)', () => {
  afterEach(() => clearSession());

  it('rechaza nombre vacío con VALIDATION:nombre:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => categoriaCreateHandler(db, { nombre: '' } as any)).toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('rechaza nombre de tipo equivocado con VALIDATION:nombre:TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => categoriaCreateHandler(db, { nombre: 123 } as any)).toThrow(/VALIDATION:nombre:TIPO/);
  });

  it('rechaza categoria_padre_id no string con VALIDATION:categoria_padre_id:TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => categoriaCreateHandler(db, { nombre: 'X', categoria_padre_id: 5 } as any))
      .toThrow(/VALIDATION:categoria_padre_id:TIPO/);
  });

  it('acepta payload válido (happy path intacto)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = categoriaCreateHandler(db, { nombre: 'Herramientas' } as any);
    expect(row.nombre).toBe('Herramientas');
  });

  it('update rechaza nombre vacío cuando se envía', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = categoriaCreateHandler(db, { nombre: 'Herramientas' } as any);
    expect(() => categoriaUpdateHandler(db, { id: row.id, nombre: '' } as any))
      .toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('update rechaza activo no booleano', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = categoriaCreateHandler(db, { nombre: 'Herramientas' } as any);
    expect(() => categoriaUpdateHandler(db, { id: row.id, activo: 'si' } as any))
      .toThrow(/VALIDATION:activo:TIPO/);
  });

  it('update acepta cambio válido de nombre', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = categoriaCreateHandler(db, { nombre: 'Herramientas' } as any);
    const upd = categoriaUpdateHandler(db, { id: row.id, nombre: 'Manuales' } as any);
    expect(upd.nombre).toBe('Manuales');
  });
});
