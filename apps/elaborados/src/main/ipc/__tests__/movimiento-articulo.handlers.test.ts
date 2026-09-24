import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../articulo';
import { movimientoArticuloListHandler, movimientoArticuloCreateHandler } from '../movimiento-articulo';

type Db = ReturnType<typeof setupDb>;

describe('movimiento-articulo handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('list incluye el movimiento inicial del alta', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    const movs = movimientoArticuloListHandler(db, { articulo_id: a.id });
    expect(movs).toHaveLength(1);
    expect(movs[0].motivo).toBe('inicial');
  });

  it('entrada con costo actualiza el costo promedio ponderado del artículo', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'compra', cantidad: 10, costo_unitario_centavos: 10000 });
    const art1 = db.select().from(schema.articulo).where(eq(schema.articulo.id, a.id)).get()!;
    expect(art1.costo_promedio_centavos).toBe(10000);

    movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'compra', cantidad: 10, costo_unitario_centavos: 20000 });
    const art2 = db.select().from(schema.articulo).where(eq(schema.articulo.id, a.id)).get()!;
    expect(art2.costo_promedio_centavos).toBe(15000);
  });

  it('artículo que bloquea sin stock: un ajuste que deja stock < 0 lanza STOCK_INSUFICIENTE', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Cucurucho', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
    expect(() => movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'merma', cantidad: -1 }))
      .toThrow('STOCK_INSUFICIENTE');
  });

  it('artículo que NO bloquea: permite quedar en negativo', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    const mov = movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'merma', cantidad: -2 });
    expect(mov.stock_resultante).toBe(-2);
  });

  it('"tacho vacío" (conteo a 0) desde stock positivo', () => {
    loginAsAdmin(db);
    const a = articuloCreateHandler(db, { nombre: 'Frutilla', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'compra', cantidad: 5, costo_unitario_centavos: 500 });
    const mov = movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'conteo', cantidad: -5 });
    expect(mov.stock_resultante).toBe(0);
  });
});
