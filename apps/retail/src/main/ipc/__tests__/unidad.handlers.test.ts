import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import {
  unidadListHandler, unidadListAllHandler,
  unidadCreateHandler, unidadUpdateHandler,
  unidadDesactivarHandler, unidadReactivarHandler,
} from '../unidad';
import { productoCreateHandler } from '../producto';
import { categoriaCreateHandler } from '../categoria';

describe('unidad handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); clearSession(); });

  it('lista vacía sin unidades', () => {
    expect(unidadListHandler(db)).toHaveLength(0);
  });

  it('crea unidad y la lista', () => {
    loginAsAdmin(db);
    unidadCreateHandler(db, { nombre: 'Unidad', abreviatura: 'u' });
    const list = unidadListHandler(db);
    expect(list).toHaveLength(1);
    expect(list[0].nombre).toBe('Unidad');
    expect(list[0].abreviatura).toBe('u');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => unidadCreateHandler(db, { nombre: 'X', abreviatura: 'x' })).toThrow('UNAUTHENTICATED');
  });

  it('unidadListAllHandler devuelve activas e inactivas', () => {
    loginAsAdmin(db);
    const u1 = unidadCreateHandler(db, { nombre: 'Activa', abreviatura: 'u1' });
    const u2 = unidadCreateHandler(db, { nombre: 'Inactiva', abreviatura: 'u2' });
    unidadDesactivarHandler(db, { id: u2.id });
    const all = unidadListAllHandler(db);
    expect(all.some(u => u.id === u1.id)).toBe(true);
    expect(all.some(u => u.id === u2.id)).toBe(true);
  });

  it('unidadListHandler solo devuelve activas', () => {
    loginAsAdmin(db);
    const u = unidadCreateHandler(db, { nombre: 'X', abreviatura: 'x' });
    unidadDesactivarHandler(db, { id: u.id });
    expect(unidadListHandler(db).some(x => x.id === u.id)).toBe(false);
  });

  it('unidadUpdateHandler edita nombre y abreviatura', () => {
    loginAsAdmin(db);
    const u = unidadCreateHandler(db, { nombre: 'Orig', abreviatura: 'org' });
    unidadUpdateHandler(db, { id: u.id, nombre: 'Nuevo', abreviatura: 'nvo' });
    const row = db.select().from(schema.unidad).where(eq(schema.unidad.id, u.id)).get()!;
    expect(row.nombre).toBe('Nuevo');
    expect(row.abreviatura).toBe('nvo');
  });

  it('unidadDesactivarHandler desactiva unidad sin productos', () => {
    loginAsAdmin(db);
    const u = unidadCreateHandler(db, { nombre: 'Vacía', abreviatura: 'vac' });
    unidadDesactivarHandler(db, { id: u.id });
    const row = db.select().from(schema.unidad).where(eq(schema.unidad.id, u.id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('unidadDesactivarHandler bloquea si hay producto con unidad_venta', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const u = unidadCreateHandler(db, { nombre: 'Pieza', abreviatura: 'pz' });
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).all()[0];
    productoCreateHandler(db, {
      nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'pz', precio_venta_lista: 100,
    });
    expect(() => unidadDesactivarHandler(db, { id: u.id })).toThrow('TIENE_PRODUCTOS:1');
  });

  it('unidadDesactivarHandler bloquea si hay producto con unidad_compra', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const u = unidadCreateHandler(db, { nombre: 'Caja', abreviatura: 'cj' });
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).all()[0];
    productoCreateHandler(db, {
      nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', unidad_compra: 'cj', precio_venta_lista: 100,
    });
    expect(() => unidadDesactivarHandler(db, { id: u.id })).toThrow('TIENE_PRODUCTOS:1');
  });

  it('unidadReactivarHandler reactiva unidad inactiva', () => {
    loginAsAdmin(db);
    const u = unidadCreateHandler(db, { nombre: 'React', abreviatura: 'rc' });
    unidadDesactivarHandler(db, { id: u.id });
    unidadReactivarHandler(db, { id: u.id });
    const row = db.select().from(schema.unidad).where(eq(schema.unidad.id, u.id)).get()!;
    expect(row.activo).toBe(true);
  });
});
