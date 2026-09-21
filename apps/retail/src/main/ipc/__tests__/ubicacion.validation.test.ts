import { describe, it, expect, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { ubicacionCreateHandler, ubicacionUpdateHandler } from '../ubicacion';

describe('ubicacion validación (ADR-082)', () => {
  afterEach(() => clearSession());

  it('rechaza sector vacío con VALIDATION:sector:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ubicacionCreateHandler(db, { sector: '', estante: 'A', posicion: '1' } as any))
      .toThrow(/VALIDATION:sector:REQUERIDO/);
  });

  it('rechaza estante vacío con VALIDATION:estante:REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ubicacionCreateHandler(db, { sector: 'S1', estante: '', posicion: '1' } as any))
      .toThrow(/VALIDATION:estante:REQUERIDO/);
  });

  it('rechaza posicion de tipo equivocado con VALIDATION:posicion:TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => ubicacionCreateHandler(db, { sector: 'S1', estante: 'A', posicion: 3 } as any))
      .toThrow(/VALIDATION:posicion:TIPO/);
  });

  it('acepta payload válido (happy path intacto)', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = ubicacionCreateHandler(db, { sector: 'S1', estante: 'A', posicion: '1' } as any);
    expect(row.sector).toBeTruthy();
  });

  it('update rechaza activo no booleano', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = ubicacionCreateHandler(db, { sector: 'S1', estante: 'A', posicion: '1' } as any);
    expect(() => ubicacionUpdateHandler(db, { id: row.id, activo: 'no' } as any))
      .toThrow(/VALIDATION:activo:TIPO/);
  });

  it('update acepta cambio válido de descripcion', () => {
    const db = setupDb(); loginAsAdmin(db);
    const row = ubicacionCreateHandler(db, { sector: 'S1', estante: 'A', posicion: '1' } as any);
    const upd = ubicacionUpdateHandler(db, { id: row.id, descripcion: 'Estante superior' } as any);
    expect(upd.descripcion).toBe('Estante superior');
  });
});
