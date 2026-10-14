import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { articuloCreateHandler } from '../articulo';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { proveedorListHandler, proveedorCrearRapidoHandler } from '../proveedor';
import { compraCrearHandler, compraAnularHandler, compraListHandler, compraGetHandler } from '../compra';

type Db = ReturnType<typeof setupDb>;
const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

describe('compra handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function armar() {
    loginAsAdmin(db);
    const leche = articuloCreateHandler(db, { nombre: 'Leche', tipo: 'insumo', unidad: 'l', bloquea_sin_stock: false });
    const envase = articuloCreateHandler(db, { nombre: 'Envase', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
    return { leche, envase };
  }
  const stock = (id: string) => db.select().from(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, id)).get()!.stock;
  const costo = (id: string) => db.select().from(schema.articulo).where(eq(schema.articulo.id, id)).get()!.costo_promedio_centavos;

  it('crear: numera CP-<terminal>-000001, suma stock, fija costo y guarda snapshots y total', () => {
    const { leche } = armar();
    const c = compraCrearHandler(db, {
      comprobante: 'A-0001-123',
      items: [{ articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 150 }],
    });
    expect(c.numero).toMatch(/^CP-.+-000001$/);
    expect(c.total_centavos).toBe(1500);
    expect(c.estado).toBe('confirmada');
    expect(stock(leche.id)).toBe(10);
    expect(costo(leche.id)).toBe(150);
    const g = compraGetHandler(db, { id: c.id })!;
    expect(g.items).toHaveLength(1);
    expect(g.items[0]).toMatchObject({ descripcion: 'Leche', cantidad: 10, subtotal_centavos: 1500 });
    const mov = db.select().from(schema.movimiento_articulo).where(eq(schema.movimiento_articulo.referencia_id, c.id)).all();
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ tipo: 'entrada', motivo: 'compra', referencia_tipo: 'compra', stock_resultante: 10 });
  });

  it('crear: costo promedio ponderado con stock previo', () => {
    const { leche } = armar();
    movimientoArticuloCreateHandler(db, { articulo_id: leche.id, motivo: 'compra', cantidad: 10, costo_unitario_centavos: 100 });
    compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 200 }] });
    expect(costo(leche.id)).toBe(150);
    expect(stock(leche.id)).toBe(20);
  });

  it('crear: el mismo artículo repetido pondera en orden', () => {
    const { leche } = armar();
    compraCrearHandler(db, { items: [
      { articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 100 },
      { articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 200 },
    ] });
    expect(costo(leche.id)).toBe(150);
    expect(stock(leche.id)).toBe(20);
  });

  it('crear: validaciones (sin ítems, cantidad 0, artículo inexistente, proveedor inexistente)', () => {
    const { leche } = armar();
    expect(() => compraCrearHandler(db, { items: [] })).toThrow();
    expect(() => compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 0, costo_unitario_centavos: 1 }] })).toThrow();
    expect(() => compraCrearHandler(db, { items: [{ articulo_id: 'nope', cantidad: 1, costo_unitario_centavos: 1 }] })).toThrow('NOT_FOUND');
    expect(() => compraCrearHandler(db, { proveedor_id: 'nope', items: [{ articulo_id: leche.id, cantidad: 1, costo_unitario_centavos: 1 }] })).toThrow('NOT_FOUND');
    expect(db.select().from(schema.compra).all()).toHaveLength(0);
  });

  it('crear: requiere sesión', () => {
    expect(() => compraCrearHandler(db, { items: [] })).toThrow('UNAUTHENTICATED');
  });

  it('crear: un fallo no quema el correlativo', () => {
    const { leche } = armar();
    expect(() => compraCrearHandler(db, { items: [
      { articulo_id: leche.id, cantidad: 1, costo_unitario_centavos: 1 },
      { articulo_id: 'nope', cantidad: 1, costo_unitario_centavos: 1 },
    ] })).toThrow('NOT_FOUND');
    const c = compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 1, costo_unitario_centavos: 1 }] });
    expect(c.numero).toMatch(/-000001$/);
  });

  it('anular: exige supervisor, revierte el stock, deja el costo y marca anulada', () => {
    const { leche } = armar();
    const c = compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 150 }] });
    expect(() => compraAnularHandler(db, { id: c.id, motivo: 'error' })).toThrow('ANULACION_REQUIERE_AUTORIZACION');
    const r = compraAnularHandler(db, { id: c.id, motivo: 'error de carga', supervisor_credenciales: SUP });
    expect(r.estado).toBe('anulada');
    expect(r.motivo_anulacion).toBe('error de carga');
    expect(stock(leche.id)).toBe(0);
    expect(costo(leche.id)).toBe(150);
    const movs = db.select().from(schema.movimiento_articulo).where(eq(schema.movimiento_articulo.referencia_id, c.id)).all();
    expect(movs.map((m) => m.motivo).sort()).toEqual(['compra', 'compra_anulacion']);
    expect(() => compraAnularHandler(db, { id: c.id, motivo: 'otra vez', supervisor_credenciales: SUP })).toThrow('YA_ANULADA');
  });

  it('anular: granel que no bloquea queda en negativo; reventa que bloquea falla sin cambios', () => {
    const { leche, envase } = armar();
    const c1 = compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 10, costo_unitario_centavos: 100 }] });
    movimientoArticuloCreateHandler(db, { articulo_id: leche.id, motivo: 'merma', cantidad: -8 });
    compraAnularHandler(db, { id: c1.id, motivo: 'x', supervisor_credenciales: SUP });
    expect(stock(leche.id)).toBe(-8);

    const c2 = compraCrearHandler(db, { items: [{ articulo_id: envase.id, cantidad: 5, costo_unitario_centavos: 10 }] });
    movimientoArticuloCreateHandler(db, { articulo_id: envase.id, motivo: 'merma', cantidad: -3 });
    expect(() => compraAnularHandler(db, { id: c2.id, motivo: 'x', supervisor_credenciales: SUP })).toThrow('STOCK_INSUFICIENTE:Envase');
    expect(stock(envase.id)).toBe(2);
    expect(db.select().from(schema.compra).where(eq(schema.compra.id, c2.id)).get()!.estado).toBe('confirmada');
  });

  it('list: más recientes primero con nombre de proveedor', () => {
    const { leche } = armar();
    const prov = proveedorCrearRapidoHandler(db, { razon_social: 'Lácteos SA' });
    compraCrearHandler(db, { proveedor_id: prov.id, items: [{ articulo_id: leche.id, cantidad: 1, costo_unitario_centavos: 1 }] });
    const l = compraListHandler(db);
    expect(l).toHaveLength(1);
    expect(l[0]!.proveedor_nombre).toBe('Lácteos SA');
  });

  it('proveedor: alta rápida con defaults, lista activos, razón social obligatoria', () => {
    loginAsAdmin(db);
    const p = proveedorCrearRapidoHandler(db, { razon_social: ' Dulces SRL ' });
    expect(p.razon_social).toBe('Dulces SRL');
    expect(proveedorListHandler(db).map((x) => x.razon_social)).toEqual(['Dulces SRL']);
    expect(() => proveedorCrearRapidoHandler(db, { razon_social: '  ' })).toThrow();
  });
});
