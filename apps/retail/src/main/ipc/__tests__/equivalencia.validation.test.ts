import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { equivalenciaAddHandler, equivalenciaRemoveHandler } from '../equivalencia';
import * as schema from '../../db/schema';

type Db = ReturnType<typeof setupDb>;
let db: Db;

function seed() {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Ferretería test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  const mk = (nombre_corto: string) => productoCreateHandler(db, {
    nombre_corto, categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'unidad', precio_venta_lista: 100,
  });
  return { a: mk('Pincel obra 3x8'), b: mk('Pincel 3x8 marca B') };
}

beforeEach(() => {
  db = setupDb();
  loginAsAdmin(db);
});
afterEach(() => { clearSession(); });

describe('equivalenciaAddHandler / equivalenciaRemoveHandler — validación de payload (ADR-085)', () => {
  it('rechaza add sin producto_id', () => {
    const { b } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_id: '', producto_relacionado_id: b.id, tipo: 'equivalente' } as any))
      .toThrow('VALIDATION:producto_id:REQUERIDO');
  });

  it('rechaza add sin producto_relacionado_id', () => {
    const { a } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: '', tipo: 'equivalente' } as any))
      .toThrow('VALIDATION:producto_relacionado_id:REQUERIDO');
  });

  it('rechaza add con producto_id de tipo inválido (omitido)', () => {
    const { b } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_relacionado_id: b.id, tipo: 'equivalente' } as any))
      .toThrow('VALIDATION:producto_id:TIPO');
  });

  it('rechaza tipo fuera del enum', () => {
    const { a, b } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'no-existe' } as any))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('rechaza nota con tipo inválido', () => {
    const { a, b } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente', nota: 123 } as any))
      .toThrow('VALIDATION:nota:TIPO');
  });

  it('acepta payload válido', () => {
    const { a, b } = seed();
    const row = equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' } as any);
    expect(row.producto_id).toBe(a.id);
    expect(row.producto_relacionado_id).toBe(b.id);
  });

  it('sigue respetando AUTO_RELACION y RELACION_DUPLICADA (guardas de negocio, no de validación)', () => {
    const { a, b } = seed();
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: a.id, tipo: 'equivalente' } as any))
      .toThrow('AUTO_RELACION');
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' } as any);
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' } as any))
      .toThrow('RELACION_DUPLICADA');
  });

  it('rechaza remove sin id', () => {
    expect(() => equivalenciaRemoveHandler(db, { id: '' } as any))
      .toThrow('VALIDATION:id:REQUERIDO');
  });

  it('rechaza remove con id de tipo inválido', () => {
    expect(() => equivalenciaRemoveHandler(db, { id: 123 } as any))
      .toThrow('VALIDATION:id:TIPO');
  });
});
