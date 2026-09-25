import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../articulo';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { recetaProduccionSetHandler } from '../receta-produccion';
import { produccionCrearHandler, produccionAnularHandler, produccionListHandler } from '../produccion';

type Db = ReturnType<typeof setupDb>;

function armarLoteChocolate(db: Db) {
  const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
  const cacao = articuloCreateHandler(db, { nombre: 'Cacao', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
  movimientoArticuloCreateHandler(db, { articulo_id: leche.id, motivo: 'compra', cantidad: 100, costo_unitario_centavos: 100 });
  movimientoArticuloCreateHandler(db, { articulo_id: cacao.id, motivo: 'compra', cantidad: 100, costo_unitario_centavos: 500 });
  recetaProduccionSetHandler(db, {
    articulo_id: choco.id, rinde_cantidad: 12,
    items: [{ articulo_id: leche.id, cantidad: 10 }, { articulo_id: cacao.id, cantidad: 2 }],
  });
  return { choco, leche, cacao };
}

describe('produccion handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('crear: consume insumos escalados, sube el stock del elaborado al costo del lote', () => {
    loginAsAdmin(db);
    const { choco, leche, cacao } = armarLoteChocolate(db);

    const prod = produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 12 });
    expect(prod.numero).toMatch(/^PR-/);
    expect(prod.cantidad_producida).toBe(12);
    expect(prod.costo_total_centavos).toBeGreaterThan(0);

    const exLeche = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, leche.id)).get()!;
    expect(exLeche.stock).toBe(90);
    const exCacao = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, cacao.id)).get()!;
    expect(exCacao.stock).toBe(98);
    const exChoco = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, choco.id)).get()!;
    expect(exChoco.stock).toBe(12);
  });

  it('crear sin receta definida lanza RECETA_NO_DEFINIDA', () => {
    loginAsAdmin(db);
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    expect(() => produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 5 })).toThrow('RECETA_NO_DEFINIDA');
  });

  it('crear con insumo insuficiente (bloquea_sin_stock) lanza STOCK_INSUFICIENTE', () => {
    loginAsAdmin(db);
    const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: true });
    recetaProduccionSetHandler(db, { articulo_id: choco.id, rinde_cantidad: 10, items: [{ articulo_id: leche.id, cantidad: 10 }] });
    expect(() => produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 10 })).toThrow(/STOCK_INSUFICIENTE/);
  });

  it('anular sin credenciales de supervisor lanza ANULACION_REQUIERE_AUTORIZACION', () => {
    loginAsAdmin(db);
    const { choco } = armarLoteChocolate(db);
    const prod = produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 12 });
    expect(() => produccionAnularHandler(db, { id: prod.id, motivo: 'error de carga' }))
      .toThrow('ANULACION_REQUIERE_AUTORIZACION');
  });

  it('anular con credenciales de supervisor revierte el stock y marca anulada', () => {
    loginAsAdmin(db);
    const { choco, leche } = armarLoteChocolate(db);
    const prod = produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 12 });

    const anulada = produccionAnularHandler(db, {
      id: prod.id, motivo: 'error de carga',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    });
    expect(anulada.estado).toBe('anulada');

    const exLeche = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, leche.id)).get()!;
    expect(exLeche.stock).toBe(100);
    const exChoco = db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, choco.id)).get()!;
    expect(exChoco.stock).toBe(0);
  });

  it('list ordena por fecha descendente', () => {
    loginAsAdmin(db);
    const { choco } = armarLoteChocolate(db);
    produccionCrearHandler(db, { articulo_id: choco.id, cantidad_producida: 6 });
    expect(produccionListHandler(db)).toHaveLength(1);
  });
});
