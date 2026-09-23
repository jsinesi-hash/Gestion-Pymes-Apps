import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { clienteUpsertHandler, clienteGetHandler } from '@core/main';

type Db = ReturnType<typeof setupDb>;
let db: Db;

beforeEach(() => {
  db = setupDb();
  clearSession();
  loginAsAdmin(db);
});

// Payload mínimo válido (todos los campos NOT NULL que el handler inserta).
const valido = {
  nombre: 'Juan',
  apellido: 'Perez',
  tipo_documento: 'DNI',
  numero_documento: '12345678',
  condicion_fiscal: 'Consumidor Final',
} as const;

describe('clienteUpsertHandler — validación de payload (ADR-082)', () => {
  it('rechaza nombre vacío', () => {
    expect(() => clienteUpsertHandler(db, { ...valido, nombre: '' } as any))
      .toThrow(/VALIDATION:nombre:REQUERIDO/);
  });

  it('rechaza nombre no-string', () => {
    expect(() => clienteUpsertHandler(db, { ...valido, nombre: 123 } as any))
      .toThrow(/VALIDATION:nombre:TIPO/);
  });

  it('rechaza apellido vacío', () => {
    expect(() => clienteUpsertHandler(db, { ...valido, apellido: '' } as any))
      .toThrow(/VALIDATION:apellido:REQUERIDO/);
  });

  it('rechaza tipo_documento inválido', () => {
    expect(() => clienteUpsertHandler(db, { ...valido, tipo_documento: 'XX' } as any))
      .toThrow(/VALIDATION:tipo_documento:ENUM/);
  });

  it('rechaza condicion_fiscal inválida', () => {
    expect(() => clienteUpsertHandler(db, { ...valido, condicion_fiscal: 'Otra' } as any))
      .toThrow(/VALIDATION:condicion_fiscal:ENUM/);
  });

  it('acepta payload válido', () => {
    const { id } = clienteUpsertHandler(db, { ...valido } as any);
    const row = clienteGetHandler(db, id)!;
    expect(row.nombre).toBe('Juan');
    expect(row.apellido).toBe('Perez');
  });

  it('acepta numero_documento vacío (opcional en el form)', () => {
    const { id } = clienteUpsertHandler(db, { ...valido, numero_documento: '' } as any);
    const row = clienteGetHandler(db, id)!;
    expect(row.numero_documento).toBe('');
  });
});
