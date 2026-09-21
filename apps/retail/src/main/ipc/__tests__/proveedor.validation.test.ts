import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { proveedorUpsertHandler, proveedorGetHandler } from '../proveedor';

type Db = ReturnType<typeof setupDb>;
let db: Db;

beforeEach(() => {
  db = setupDb();
  clearSession();
  loginAsAdmin(db);
});

// Payload mínimo válido (todos los campos NOT NULL que el handler inserta).
const valido = {
  razon_social: 'Acme SA',
  tipo_documento: 'CUIT',
  numero_documento: '20111111112',
  condicion_fiscal: 'Responsable Inscripto',
} as const;

describe('proveedorUpsertHandler — validación de payload (ADR-082)', () => {
  it('rechaza razon_social vacía', () => {
    expect(() => proveedorUpsertHandler(db, { razon_social: '' } as any))
      .toThrow(/VALIDATION:razon_social:REQUERIDO/);
  });

  it('rechaza razon_social no-string', () => {
    expect(() => proveedorUpsertHandler(db, { ...valido, razon_social: 5 } as any))
      .toThrow(/VALIDATION:razon_social:TIPO/);
  });

  it('rechaza tipo_documento inválido', () => {
    expect(() => proveedorUpsertHandler(db, { ...valido, tipo_documento: 'ZZ' } as any))
      .toThrow(/VALIDATION:tipo_documento:ENUM/);
  });

  it('acepta payload válido', () => {
    const { id } = proveedorUpsertHandler(db, { ...valido } as any);
    const row = proveedorGetHandler(db, id)!;
    expect(row.razon_social).toBe('Acme SA');
  });

  it('acepta numero_documento vacío (opcional en el form)', () => {
    const { id } = proveedorUpsertHandler(db, { ...valido, numero_documento: '' } as any);
    const row = proveedorGetHandler(db, id)!;
    expect(row.numero_documento).toBe('');
  });
});
