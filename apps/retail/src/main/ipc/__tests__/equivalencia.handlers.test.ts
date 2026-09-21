import { describe, it, expect } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler, setDiscontinuadoHandler } from '../producto';
import { listaPrecioCreateHandler } from '../lista-precio';
import {
  equivalenciaAddHandler, equivalenciaListHandler, equivalenciaRemoveHandler,
} from '../equivalencia';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

type Db = ReturnType<typeof setupDb>;

function seed(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Ferretería test' });
  const imp = db.select().from(schema.impuesto).all()[0];
  const mk = (nombre_corto: string) => productoCreateHandler(db, {
    nombre_corto, categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'unidad', precio_venta_lista: 100,
  });
  listaPrecioCreateHandler(db, { nombre: 'General', ajuste_porcentual: 0, predeterminada: true });
  return { a: mk('Pincel obra 3x8'), b: mk('Pincel 3x8 marca B'), c: mk('Pincel 3x8 marca C') };
}

describe('equivalencia handlers', () => {
  it('equivalente es simétrico: B ve a A y A ve a B', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    const desdeA = equivalenciaListHandler(db, { producto_id: a.id });
    const desdeB = equivalenciaListHandler(db, { producto_id: b.id });
    expect(desdeA.equivalentes.map(e => e.producto_id)).toContain(b.id);
    expect(desdeB.equivalentes.map(e => e.producto_id)).toContain(a.id);
  });

  it('reemplazo es direccional: A ve "reemplazado_por" B; B ve "reemplaza_a" A', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'reemplazo' });
    const desdeA = equivalenciaListHandler(db, { producto_id: a.id });
    const desdeB = equivalenciaListHandler(db, { producto_id: b.id });
    expect(desdeA.reemplazado_por.map(e => e.producto_id)).toContain(b.id);
    expect(desdeA.reemplaza_a).toEqual([]);
    expect(desdeB.reemplaza_a.map(e => e.producto_id)).toContain(a.id);
    expect(desdeB.reemplazado_por).toEqual([]);
  });

  it('los ítems vienen enriquecidos con precio/stock/marca/discontinuado', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    const it = equivalenciaListHandler(db, { producto_id: a.id }).equivalentes[0];
    expect(it.precio_final_centavos).toBe(10000);
    expect(it.stock_fisico).toBe(0);
    expect(it).toHaveProperty('marca_nombre');
    expect(it).toHaveProperty('discontinuado');
    expect(it).toHaveProperty('id');
  });

  it('rechaza auto-relación y duplicados (incluida la inversa de equivalente)', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: a.id, tipo: 'equivalente' }))
      .toThrow('AUTO_RELACION');
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' }))
      .toThrow('RELACION_DUPLICADA');
    expect(() => equivalenciaAddHandler(db, { producto_id: b.id, producto_relacionado_id: a.id, tipo: 'equivalente' }))
      .toThrow('RELACION_DUPLICADA');
  });

  it('remove hace soft-delete y desaparece del list; se puede recrear', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    const fila = equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    equivalenciaRemoveHandler(db, { id: fila.id });
    expect(equivalenciaListHandler(db, { producto_id: a.id }).equivalentes).toEqual([]);
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' })).not.toThrow();
  });

  it('setDiscontinuado marca el producto', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a } = seed(db);
    setDiscontinuadoHandler(db, { id: a.id, discontinuado: true });
    const p = db.select().from(schema.producto).where(eq(schema.producto.id, a.id)).get()!;
    expect(p.discontinuado).toBe(true);
  });

  it('excluye relacionados inactivos (soft-deleted del catálogo)', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    db.update(schema.producto).set({ activo: false }).where(eq(schema.producto.id, b.id)).run();
    const rel = equivalenciaListHandler(db, { producto_id: a.id }).equivalentes;
    expect(rel.map(e => e.producto_id)).not.toContain(b.id);
  });

  it('add/remove/setDiscontinuado lanzan UNAUTHENTICATED sin sesión', () => {
    const db = setupDb(); clearSession(); loginAsAdmin(db);
    const { a, b } = seed(db);
    const fila = equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'equivalente' });
    clearSession();
    expect(() => equivalenciaAddHandler(db, { producto_id: a.id, producto_relacionado_id: b.id, tipo: 'reemplazo' })).toThrow('UNAUTHENTICATED');
    expect(() => equivalenciaRemoveHandler(db, { id: fila.id })).toThrow('UNAUTHENTICATED');
    expect(() => setDiscontinuadoHandler(db, { id: a.id, discontinuado: true })).toThrow('UNAUTHENTICATED');
  });
});
