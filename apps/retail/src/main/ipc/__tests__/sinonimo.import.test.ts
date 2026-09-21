import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import * as schema from '../../db/schema';
import {
  sinonimoImportarValidarHandler,
  sinonimoImportarHandler,
  sinonimoGrupoCreateHandler,
  sinonimoGrupoListHandler,
} from '../sinonimo';

const CSV_OK = [
  'canonico,sinonimos,abreviaturas,rubro,nota',
  'alicate,pinza|tenaza,alic.,Herramientas,',
  'lampara,foco|bombilla,lamp.,Electricidad,',
].join('\n');

describe('sinonimo import (ADR-067 Fase 4)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); loginAsAdmin(db); });
  afterEach(() => { clearSession(); });

  it('preview parsea y valida sin escribir', () => {
    const prev = sinonimoImportarValidarHandler(db, { csv: CSV_OK });
    expect(prev.grupos).toBe(2);
    expect(prev.errores).toEqual([]);
    // no escribió nada
    expect(db.select().from(schema.sinonimo).all().length).toBe(0);
  });

  it('importa los grupos con origen=import', () => {
    const res = sinonimoImportarHandler(db, { csv: CSV_OK });
    expect(res.gruposImportados).toBe(2);
    expect(res.errores).toEqual([]);
    const filas = db.select().from(schema.sinonimo).all();
    expect(filas.every(f => f.origen === 'import')).toBe(true);
    expect(sinonimoGrupoListHandler(db, {}).map(g => g.canonico).sort()).toEqual(['alicate', 'lampara']);
  });

  it('CSV con encabezado inválido NO importa y reporta error', () => {
    const res = sinonimoImportarHandler(db, { csv: 'canonico,sinonimos\nalicate,pinza' });
    expect(res.gruposImportados).toBe(0);
    expect(res.errores.length).toBeGreaterThan(0);
    expect(db.select().from(schema.sinonimo).all().length).toBe(0);
  });

  it('reemplazar borra imports previos pero conserva los grupos manuales', () => {
    sinonimoGrupoCreateHandler(db, { canonico: 'martillo', sinonimos: ['maceta'] }); // origen=manual
    sinonimoImportarHandler(db, { csv: CSV_OK });                                     // 2 import
    expect(db.select().from(schema.sinonimo).all().filter(f => f.origen === 'import').length).toBeGreaterThan(0);

    // Reimporta sólo la lámpara, reemplazando lo importado.
    const csv2 = 'canonico,sinonimos,abreviaturas,rubro,nota\nlampara,foco,,Electricidad,';
    const res = sinonimoImportarHandler(db, { csv: csv2, reemplazar: true });
    expect(res.gruposImportados).toBe(1);

    const canonicos = sinonimoGrupoListHandler(db, {}).map(g => g.canonico).sort();
    expect(canonicos).toContain('martillo'); // manual, intacto
    expect(canonicos).toContain('lampara');  // reimportado
    expect(canonicos).not.toContain('alicate'); // import anterior, borrado
  });

  it('exige sesión de Supervisor', () => {
    clearSession();
    expect(() => sinonimoImportarHandler(db, { csv: CSV_OK })).toThrow('UNAUTHENTICATED');
  });
});
