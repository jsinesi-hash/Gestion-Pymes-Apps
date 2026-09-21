import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import {
  marcaListHandler, marcaListAllHandler,
  marcaCreateHandler, marcaUpdateHandler,
  marcaDesactivarHandler, marcaReactivarHandler,
} from '../marca';
import { productoCreateHandler } from '../producto';
import { categoriaCreateHandler } from '../categoria';

describe('marca handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); clearSession(); });

  it('lista vacía sin marcas', () => {
    expect(marcaListHandler(db)).toHaveLength(0);
  });

  it('crea marca y la lista', () => {
    loginAsAdmin(db);
    marcaCreateHandler(db, { nombre: 'Bosch' });
    expect(marcaListHandler(db)).toHaveLength(1);
    expect(marcaListHandler(db)[0].nombre).toBe('Bosch');
  });

  it('lanza UNAUTHENTICATED sin sesión', () => {
    expect(() => marcaCreateHandler(db, { nombre: 'X' })).toThrow('UNAUTHENTICATED');
  });

  it('marcaListAllHandler devuelve activas e inactivas', () => {
    loginAsAdmin(db);
    const m1 = marcaCreateHandler(db, { nombre: 'Activa' });
    const m2 = marcaCreateHandler(db, { nombre: 'Inactiva' });
    marcaDesactivarHandler(db, { id: m2.id });
    const all = marcaListAllHandler(db);
    expect(all.some(m => m.id === m1.id)).toBe(true);
    expect(all.some(m => m.id === m2.id)).toBe(true);
  });

  it('marcaListHandler solo devuelve activas', () => {
    loginAsAdmin(db);
    const m = marcaCreateHandler(db, { nombre: 'X' });
    marcaDesactivarHandler(db, { id: m.id });
    const activas = marcaListHandler(db);
    expect(activas.some(x => x.id === m.id)).toBe(false);
  });

  it('marcaUpdateHandler edita nombre y descripcion', () => {
    loginAsAdmin(db);
    const m = marcaCreateHandler(db, { nombre: 'Orig' });
    marcaUpdateHandler(db, { id: m.id, nombre: 'Nuevo', descripcion: 'Desc' });
    const row = db.select().from(schema.marca).where(eq(schema.marca.id, m.id)).get()!;
    expect(row.nombre).toBe('Nuevo');
    expect(row.descripcion).toBe('Desc');
  });

  it('marcaDesactivarHandler desactiva marca sin productos', () => {
    loginAsAdmin(db);
    const m = marcaCreateHandler(db, { nombre: 'Vacía' });
    marcaDesactivarHandler(db, { id: m.id });
    const row = db.select().from(schema.marca).where(eq(schema.marca.id, m.id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('marcaDesactivarHandler lanza TIENE_PRODUCTOS:N con productos activos', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const marca = marcaCreateHandler(db, { nombre: 'ConProd' });
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto).all()[0];
    productoCreateHandler(db, {
      nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 100, marca_id: marca.id,
    });
    expect(() => marcaDesactivarHandler(db, { id: marca.id }))
      .toThrow('TIENE_PRODUCTOS:1');
  });

  it('marcaReactivarHandler reactiva marca inactiva', () => {
    loginAsAdmin(db);
    const m = marcaCreateHandler(db, { nombre: 'React' });
    marcaDesactivarHandler(db, { id: m.id });
    marcaReactivarHandler(db, { id: m.id });
    const row = db.select().from(schema.marca).where(eq(schema.marca.id, m.id)).get()!;
    expect(row.activo).toBe(true);
  });
});
