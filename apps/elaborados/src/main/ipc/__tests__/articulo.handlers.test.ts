import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler, articuloListHandler, articuloUpdateHandler, articuloGetHandler } from '../articulo';

type Db = ReturnType<typeof setupDb>;

describe('articulo handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('create: crea el artículo, su existencia en 0 y el movimiento inicial', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    expect(a.nombre).toBe('Leche');
    const ex = db.select().from(schema.existencia_articulo)
      .where(eq(schema.existencia_articulo.articulo_id, a.id)).get();
    expect(ex?.stock).toBe(0);
  });

  it('list incluye el stock actual', () => {
    loginAsAdmin(db);
    articuloCreateHandler(db, { nombre: 'Azúcar', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
    const list = articuloListHandler(db);
    expect(list).toHaveLength(1);
    expect(list[0].stock).toBe(0);
  });

  it('create rechaza tipo inválido', () => {
    loginAsAdmin(db);
    expect(() => articuloCreateHandler(db, { nombre: 'X', tipo: 'invalido', unidad: 'kg', bloquea_sin_stock: true }))
      .toThrow('VALIDATION:tipo:ENUM');
  });

  it('update cambia bloquea_sin_stock', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Cucurucho', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: false });
    const updated = articuloUpdateHandler(db, { id: a.id, bloquea_sin_stock: true });
    expect(updated.bloquea_sin_stock).toBe(true);
  });

  it('get devuelve null si no existe', () => {
    loginAsAdmin(db);
    expect(articuloGetHandler(db, { id: 'nope' })).toBeNull();
  });

  it('create sin sesión lanza UNAUTHENTICATED', () => {
    expect(() => articuloCreateHandler(db, { nombre: 'X', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: true }))
      .toThrow('UNAUTHENTICATED');
  });
});
