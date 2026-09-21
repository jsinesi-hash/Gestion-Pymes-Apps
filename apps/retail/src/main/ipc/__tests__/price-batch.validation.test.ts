import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { crearBatchHandler, aprobarBatchHandler } from '../price-batch';

describe('price-batch validación (ADR-082)', () => {
  beforeEach(() => clearSession());

  it('crear rechaza lista_precio_id ausente con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => crearBatchHandler(db, { alcance: 'catalogo' } as any))
      .toThrow(/VALIDATION:lista_precio_id:TIPO/);
  });

  it('crear rechaza alcance inválido con ENUM', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => crearBatchHandler(db, { lista_precio_id: 'l1', alcance: 'galaxia' } as any))
      .toThrow(/VALIDATION:alcance:ENUM/);
  });

  it('aprobar rechaza id ausente con TIPO', () => {
    const db = setupDb(); loginAsAdmin(db);
    expect(() => aprobarBatchHandler(db, undefined as any))
      .toThrow(/VALIDATION:id:TIPO/);
  });
});
