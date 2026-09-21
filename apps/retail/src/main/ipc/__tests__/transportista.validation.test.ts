import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { transportistaUpsertHandler, transportistaGetHandler } from '../transportista';

type Db = ReturnType<typeof setupDb>;
let db: Db;

beforeEach(() => {
  db = setupDb();
  loginAsAdmin(db);
});
afterEach(() => { clearSession(); });

describe('transportistaUpsertHandler — validación de payload (ADR-085)', () => {
  it('rechaza upsert sin razon_social', () => {
    expect(() => transportistaUpsertHandler(db, { razon_social: '' } as any))
      .toThrow('VALIDATION:razon_social:REQUERIDO');
  });

  it('rechaza razon_social no-string', () => {
    expect(() => transportistaUpsertHandler(db, { razon_social: 5 } as any))
      .toThrow('VALIDATION:razon_social:TIPO');
  });

  it('rechaza email con tipo inválido', () => {
    expect(() => transportistaUpsertHandler(db, { razon_social: 'ACME', email: 123 } as any))
      .toThrow('VALIDATION:email:TIPO');
  });

  it('acepta payload válido', () => {
    const { id } = transportistaUpsertHandler(db, { razon_social: 'ACME' } as any);
    const row = transportistaGetHandler(db, id)!;
    expect(row.razon_social).toBe('ACME');
  });

  it('acepta campos opcionales omitidos', () => {
    const { id } = transportistaUpsertHandler(db, { razon_social: 'ACME' } as any);
    const row = transportistaGetHandler(db, id)!;
    expect(row.telefono).toBeNull();
    expect(row.email).toBeNull();
  });
});
