import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import {
  categoriaListHandler,
  categoriaListAllHandler,
  categoriaCreateHandler,
  categoriaUpdateHandler,
  categoriaDesactivarHandler,
  categoriaReactivarHandler,
} from '../categoria';
import { productoCreateHandler } from '../producto';

describe('categoria handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    clearSession();
  });

  it('crea categoría raíz', () => {
    loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Herramientas' });
    expect(cat.nombre).toBe('Herramientas');
    expect(cat.categoria_padre_id).toBeNull();
  });

  it('crea categoría hija con padre', () => {
    loginAsAdmin(db);
    const padre = categoriaCreateHandler(db, { nombre: 'Herramientas' });
    const hija = categoriaCreateHandler(db, { nombre: 'Eléctricas', categoria_padre_id: padre.id });
    expect(hija.categoria_padre_id).toBe(padre.id);
  });

  it('actualiza nombre y bumps version', () => {
    loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Viejo' });
    const updated = categoriaUpdateHandler(db, { id: cat.id, nombre: 'Nuevo' });
    expect(updated.nombre).toBe('Nuevo');
    expect(updated.version).toBe(2);
  });

  describe('categoriaListAllHandler', () => {
    it('devuelve activas e inactivas', () => {
      loginAsAdmin(db);
      const c1 = categoriaCreateHandler(db, { nombre: 'Activa' });
      const c2 = categoriaCreateHandler(db, { nombre: 'Inactiva' });
      categoriaDesactivarHandler(db, { id: c2.id });
      const all = categoriaListAllHandler(db);
      expect(all.some(c => c.id === c1.id)).toBe(true);
      expect(all.some(c => c.id === c2.id)).toBe(true);
    });

    it('categoriaListHandler solo devuelve activas', () => {
      loginAsAdmin(db);
      const c = categoriaCreateHandler(db, { nombre: 'X' });
      categoriaDesactivarHandler(db, { id: c.id });
      const activas = categoriaListHandler(db);
      expect(activas.some(x => x.id === c.id)).toBe(false);
    });
  });

  describe('categoriaDesactivarHandler', () => {
    it('desactiva categoría sin productos', () => {
      loginAsAdmin(db);
      const c = categoriaCreateHandler(db, { nombre: 'Vacía' });
      categoriaDesactivarHandler(db, { id: c.id });
      const row = db.select().from(schema.categoria).where(eq(schema.categoria.id, c.id)).get()!;
      expect(row.activo).toBe(false);
    });

    it('lanza TIENE_PRODUCTOS:N si hay productos activos con esa categoría', () => {
      loginAsAdmin(db);
      runCatalogSeed(db);
      const cat = categoriaCreateHandler(db, { nombre: 'ConProducto' });
      const imp = db.select().from(schema.impuesto).all()[0];
      productoCreateHandler(db, {
        nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
        unidad_venta: 'u', precio_venta_lista: 100,
      });
      expect(() => categoriaDesactivarHandler(db, { id: cat.id }))
        .toThrow('TIENE_PRODUCTOS:1');
    });

    it('lanza NOT_FOUND con id inexistente', () => {
      loginAsAdmin(db);
      expect(() => categoriaDesactivarHandler(db, { id: 'no-existe' }))
        .toThrow('NOT_FOUND');
    });
  });

  describe('categoriaReactivarHandler', () => {
    it('reactiva categoría inactiva', () => {
      loginAsAdmin(db);
      const c = categoriaCreateHandler(db, { nombre: 'React' });
      categoriaDesactivarHandler(db, { id: c.id });
      categoriaReactivarHandler(db, { id: c.id });
      const row = db.select().from(schema.categoria).where(eq(schema.categoria.id, c.id)).get()!;
      expect(row.activo).toBe(true);
    });
  });
});
