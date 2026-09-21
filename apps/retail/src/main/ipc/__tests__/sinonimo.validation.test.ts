import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  sinonimoGrupoCreateHandler,
  sinonimoGrupoUpdateHandler,
  sinonimoGrupoDeleteHandler,
  sinonimoImportarHandler,
} from '../sinonimo';

type Db = ReturnType<typeof setupDb>;
let db: Db;

beforeEach(() => {
  db = setupDb();
  loginAsAdmin(db);
});
afterEach(() => { clearSession(); });

describe('sinonimo handlers — validación de payload (ADR-085)', () => {
  it('rechaza create sin canonico', () => {
    expect(() => sinonimoGrupoCreateHandler(db, { canonico: '' } as any))
      .toThrow('VALIDATION:canonico:REQUERIDO');
  });

  it('rechaza create con canonico no-string', () => {
    expect(() => sinonimoGrupoCreateHandler(db, { canonico: 5 } as any))
      .toThrow('VALIDATION:canonico:TIPO');
  });

  it('rechaza create con sinonimos de tipo inválido', () => {
    expect(() => sinonimoGrupoCreateHandler(db, { canonico: 'alicate', sinonimos: 'pinza' } as any))
      .toThrow('VALIDATION:sinonimos:TIPO');
  });

  it('acepta payload válido en create', () => {
    const g = sinonimoGrupoCreateHandler(db, {
      canonico: 'alicate', sinonimos: ['pinza', 'tenaza'], abreviaturas: ['alic.'], rubro: 'Herramientas',
    } as any);
    expect(g.canonico).toBe('alicate');
    expect(g.sinonimos).toEqual(['pinza', 'tenaza']);
    expect(g.abreviaturas).toEqual(['alic.']);
  });

  it('acepta campos opcionales omitidos en create', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'martillo' } as any);
    expect(g.canonico).toBe('martillo');
    expect(g.sinonimos).toEqual([]);
    expect(g.abreviaturas).toEqual([]);
    expect(g.rubro).toBeNull();
    expect(g.nota).toBeNull();
  });

  it('rechaza update sin grupo_id', () => {
    expect(() => sinonimoGrupoUpdateHandler(db, { grupo_id: '', canonico: 'lampara' } as any))
      .toThrow('VALIDATION:grupo_id:REQUERIDO');
  });

  it('rechaza update sin canonico', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'lampara' } as any);
    expect(() => sinonimoGrupoUpdateHandler(db, { grupo_id: g.grupo_id, canonico: '' } as any))
      .toThrow('VALIDATION:canonico:REQUERIDO');
  });

  it('acepta update válido', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'lampara', sinonimos: ['foco'] } as any);
    const upd = sinonimoGrupoUpdateHandler(db, {
      grupo_id: g.grupo_id, canonico: 'lampara', sinonimos: ['foco', 'bombilla'],
    } as any);
    expect(upd.sinonimos).toEqual(['foco', 'bombilla']);
  });

  it('rechaza delete sin grupo_id', () => {
    expect(() => sinonimoGrupoDeleteHandler(db, { grupo_id: '' } as any))
      .toThrow('VALIDATION:grupo_id:REQUERIDO');
  });

  it('rechaza delete con grupo_id omitido (VALIDATION:grupo_id:TIPO)', () => {
    expect(() => sinonimoGrupoDeleteHandler(db, {} as any))
      .toThrow('VALIDATION:grupo_id:TIPO');
  });

  it('acepta delete válido', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'caño', sinonimos: ['tubo'] } as any);
    const res = sinonimoGrupoDeleteHandler(db, { grupo_id: g.grupo_id } as any);
    expect(res.eliminados).toBeGreaterThan(0);
  });

  it('rechaza importar con csv vacío', () => {
    expect(() => sinonimoImportarHandler(db, { csv: '' } as any))
      .toThrow('VALIDATION:csv:REQUERIDO');
  });

  it('rechaza importar sin csv (omitido, VALIDATION:csv:TIPO)', () => {
    expect(() => sinonimoImportarHandler(db, {} as any))
      .toThrow('VALIDATION:csv:TIPO');
  });

  it('rechaza importar con csv no-string', () => {
    expect(() => sinonimoImportarHandler(db, { csv: 123 } as any))
      .toThrow('VALIDATION:csv:TIPO');
  });
});
