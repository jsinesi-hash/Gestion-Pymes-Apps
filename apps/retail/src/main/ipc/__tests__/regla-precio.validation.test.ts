import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler, reglaPrecioRemoveHandler } from '../regla-precio';

type Db = ReturnType<typeof setupDb>;
let db: Db;
let listaId: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  loginAsAdmin(db);
  const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
  listaId = lista.id;
});
afterEach(() => { clearSession(); });

describe('reglaPrecioUpsertHandler / reglaPrecioRemoveHandler — validación de payload (ADR-085)', () => {
  it('rechaza upsert sin lista_precio_id (omitido)', () => {
    expect(() => reglaPrecioUpsertHandler(db, { tipo: 'catalogo', margen_pct: 10 } as any))
      .toThrow('VALIDATION:lista_precio_id:TIPO');
  });

  it('rechaza upsert con lista_precio_id vacío', () => {
    expect(() => reglaPrecioUpsertHandler(db, { lista_precio_id: '', tipo: 'lista', margen_pct: 10 } as any))
      .toThrow('VALIDATION:lista_precio_id:REQUERIDO');
  });

  it('rechaza tipo fuera del enum', () => {
    expect(() => reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'no-existe', margen_pct: 10 } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('rechaza margen_pct de tipo inválido (omitido)', () => {
    expect(() => reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista' } as any))
      .toThrow('VALIDATION:margen_pct:TIPO');
  });

  it('rechaza margen_min_pct de tipo inválido cuando no es null', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, margen_min_pct: 'x',
    } as any)).toThrow('VALIDATION:margen_min_pct:TIPO');
  });

  it('rechaza margen_max_pct de tipo inválido cuando no es null', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, margen_max_pct: 'x',
    } as any)).toThrow('VALIDATION:margen_max_pct:TIPO');
  });

  it('rechaza redondeo_modo fuera del enum', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, redondeo_modo: 'no-existe',
    } as any)).toThrow('VALIDATION:redondeo_modo:ENUM');
  });

  it('rechaza redondeo_valor de tipo inválido cuando no es null', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, redondeo_valor: 'x',
    } as any)).toThrow('VALIDATION:redondeo_valor:TIPO');
  });

  it('rechaza prioridad no entera', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, prioridad: 1.5,
    } as any)).toThrow('VALIDATION:prioridad:NO_ENTERO');
  });

  it('rechaza prioridad negativa', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', margen_pct: 40, prioridad: -1,
    } as any)).toThrow('VALIDATION:prioridad:MIN:0');
  });

  it('rechaza objetivo_id de tipo inválido cuando no es null', () => {
    expect(() => reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'marca', margen_pct: 40, objetivo_id: 123,
    } as any)).toThrow('VALIDATION:objetivo_id:TIPO');
  });

  it('acepta payload válido con los valores reales del enum ReglaTipo/RedondeoModo', () => {
    const { id } = reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'proveedor', objetivo_id: 'prov1', margen_pct: 25,
      margen_min_pct: 10, margen_max_pct: 60, redondeo_modo: 'terminacion_99',
      redondeo_valor: null, prioridad: 5,
    } as any);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('rechaza remove sin id', () => {
    expect(() => reglaPrecioRemoveHandler(db, '' as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza remove con id de tipo inválido', () => {
    expect(() => reglaPrecioRemoveHandler(db, 123 as any))
      .toThrow('VALIDATION:id:TIPO');
  });
});
