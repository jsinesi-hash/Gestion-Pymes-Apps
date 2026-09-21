import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { listaPrecioCreateHandler } from '../lista-precio';

describe('lista-precio create validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('rechaza nombre ausente con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => listaPrecioCreateHandler(db, { ajuste_porcentual: 0 } as any))
      .toThrow(/VALIDATION:nombre:TIPO/);
  });

  it('rechaza nombre vacío con REQUERIDO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => listaPrecioCreateHandler(db, { nombre: '  ', ajuste_porcentual: 0 } as any))
      .toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('rechaza ajuste_porcentual no numérico con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: '10%' } as any))
      .toThrow(/VALIDATION:ajuste_porcentual:TIPO/);
  });

  it('rechaza tipo inválido con ENUM', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: 0, tipo: 'foo' } as any))
      .toThrow(/VALIDATION:tipo:ENUM/);
  });

  it('happy path intacto', () => {
    const db = setupDb(); loginAsAdmin(db);
    const lista = listaPrecioCreateHandler(db, { nombre: 'Mayorista', ajuste_porcentual: -10 } as any);
    expect(lista.nombre).toBe('Mayorista');
    expect(lista.tipo).toBe('general');
  });
});
