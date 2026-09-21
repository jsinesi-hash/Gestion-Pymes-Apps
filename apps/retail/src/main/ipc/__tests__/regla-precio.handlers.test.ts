import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { listaPrecioCreateHandler } from '../lista-precio';
import {
  reglaPrecioListHandler,
  reglaPrecioUpsertHandler,
  reglaPrecioRemoveHandler,
} from '../regla-precio';

type Db = ReturnType<typeof setupDb>;

let db: Db;
let listaId: string;

beforeEach(() => {
  db = setupDb();
  runCatalogSeed(db);
  clearSession();
  loginAsAdmin(db);
  const lista = listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
  listaId = lista.id;
});

describe('reglaPrecio handlers (ADR-049 §2)', () => {
  it('lista vacía cuando no hay reglas', () => {
    expect(reglaPrecioListHandler(db, listaId)).toHaveLength(0);
  });

  it('crea una regla de lista y la lista la devuelve', () => {
    const { id } = reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: 40,
      redondeo_modo: 'terminacion_90',
    });
    const rows = reglaPrecioListHandler(db, listaId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].tipo).toBe('lista');
    expect(rows[0].margen_pct).toBe(40);
    expect(rows[0].redondeo_modo).toBe('terminacion_90');
  });

  it('actualiza una regla existente por id', () => {
    const { id } = reglaPrecioUpsertHandler(db, {
      lista_precio_id: listaId, tipo: 'marca', objetivo_id: 'm1', margen_pct: 30,
    });
    reglaPrecioUpsertHandler(db, { id, lista_precio_id: listaId, tipo: 'marca', objetivo_id: 'm1', margen_pct: 35 });
    const rows = reglaPrecioListHandler(db, listaId);
    expect(rows).toHaveLength(1);
    expect(rows[0].margen_pct).toBe(35);
  });

  it('la baja lógica saca la regla de la lista', () => {
    const { id } = reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: 40 });
    reglaPrecioRemoveHandler(db, id);
    expect(reglaPrecioListHandler(db, listaId)).toHaveLength(0);
  });

  it('devuelve las reglas ordenadas por especificidad y prioridad', () => {
    reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: 10 });
    reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'producto', objetivo_id: 'p1', margen_pct: 50 });
    const rows = reglaPrecioListHandler(db, listaId);
    expect(rows[0].tipo).toBe('producto'); // más específica primero
  });

  it('sin permiso config.fiscal, el upsert falla', () => {
    clearSession();
    expect(() =>
      reglaPrecioUpsertHandler(db, { lista_precio_id: listaId, tipo: 'lista', objetivo_id: null, margen_pct: 40 }),
    ).toThrow();
  });
});
