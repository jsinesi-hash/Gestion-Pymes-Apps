import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import {
  sinonimoGrupoListHandler,
  sinonimoGrupoCreateHandler,
  sinonimoGrupoUpdateHandler,
  sinonimoGrupoDeleteHandler,
} from '../sinonimo';

describe('sinonimo ABM handlers (ADR-067)', () => {
  let db: ReturnType<typeof setupDb>;
  beforeEach(() => { db = setupDb(); loginAsAdmin(db); });
  afterEach(() => { clearSession(); });

  it('crea un grupo y lo lista', () => {
    const g = sinonimoGrupoCreateHandler(db, {
      canonico: 'alicate', sinonimos: ['pinza', 'tenaza'], abreviaturas: ['alic.'], rubro: 'Herramientas',
    });
    expect(g.canonico).toBe('alicate');
    expect(g.sinonimos).toEqual(['pinza', 'tenaza']);
    expect(g.abreviaturas).toEqual(['alic.']);
    expect(g.total_terminos).toBe(4);

    const lista = sinonimoGrupoListHandler(db, {});
    expect(lista.length).toBe(1);
    expect(lista[0].grupo_id).toBe(g.grupo_id);
  });

  it('dedup por término normalizado dentro del grupo', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'alicate', sinonimos: ['pinza', 'Pinza', 'alicate'] });
    // "Pinza"==="pinza" y "alicate"===canónico → sólo alicate + pinza
    expect(g.total_terminos).toBe(2);
  });

  it('rechaza canónico vacío', () => {
    expect(() => sinonimoGrupoCreateHandler(db, { canonico: '   ' })).toThrow('VALIDATION:canonico:REQUERIDO');
  });

  it('actualiza reemplazando los términos del grupo', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'lampara', sinonimos: ['foco'] });
    const upd = sinonimoGrupoUpdateHandler(db, {
      grupo_id: g.grupo_id, canonico: 'lampara', sinonimos: ['foco', 'bombilla', 'bombita'], abreviaturas: ['lamp.'],
    });
    expect(upd.grupo_id).toBe(g.grupo_id);
    expect(upd.sinonimos).toEqual(['foco', 'bombilla', 'bombita']);
    expect(upd.abreviaturas).toEqual(['lamp.']);
    // sigue habiendo un solo grupo
    expect(sinonimoGrupoListHandler(db, {}).length).toBe(1);
  });

  it('borra (baja lógica) el grupo: deja de listarse', () => {
    const g = sinonimoGrupoCreateHandler(db, { canonico: 'caño', sinonimos: ['tubo'] });
    const res = sinonimoGrupoDeleteHandler(db, { grupo_id: g.grupo_id });
    expect(res.eliminados).toBeGreaterThan(0);
    expect(sinonimoGrupoListHandler(db, {}).length).toBe(0);
  });

  it('la búsqueda filtra por cualquier término (acento-insensible)', () => {
    sinonimoGrupoCreateHandler(db, { canonico: 'lámpara', sinonimos: ['foco'] });
    sinonimoGrupoCreateHandler(db, { canonico: 'martillo', sinonimos: ['maceta'] });
    expect(sinonimoGrupoListHandler(db, { busqueda: 'foco' }).map(g => g.canonico)).toEqual(['lámpara']);
    expect(sinonimoGrupoListHandler(db, { busqueda: 'lampara' }).map(g => g.canonico)).toEqual(['lámpara']);
  });

  it('exige sesión de Supervisor', () => {
    clearSession();
    expect(() => sinonimoGrupoListHandler(db, {})).toThrow('UNAUTHENTICATED');
    expect(() => sinonimoGrupoCreateHandler(db, { canonico: 'x' })).toThrow('UNAUTHENTICATED');
  });
});
