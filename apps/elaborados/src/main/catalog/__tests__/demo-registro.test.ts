import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { cajaAbrirHandler, runSeed as runSeedCore } from '@core/main';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from '../../auth/seed';
import * as schema from '../../db/schema';
import { createTestDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID, asegurarConsumidorFinal, runCatalogSeedElaborados, runBaseRubroHeladeria } from '../seed';
import { articuloCreateHandler } from '../../ipc/articulo';
import { movimientoArticuloCreateHandler } from '../../ipc/movimiento-articulo';
import { recetaProduccionSetHandler } from '../../ipc/receta-produccion';
import * as produccion from '../../ipc/produccion';
import { compraCrearHandler } from '../../ipc/compra';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { runDemoHeladeriaSeed } from '../demo-heladeria';
import { vaciarDemo, estadoDemo } from '../demo-registro';

type Db = ReturnType<typeof createTestDb>;

function dbConBase(): Db {
  const db = createTestDb();
  runSeedCore(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  runCatalogSeedElaborados(db);
  runBaseRubroHeladeria(db);
  asegurarConsumidorFinal(db);
  return db;
}

const nombres = (db: Db) => db.select().from(schema.articulo).all().map((a) => a.nombre);

describe('registro del catálogo demo', () => {
  let db: Db;
  beforeEach(() => { db = dbConBase(); clearSession(); loginAsAdmin(db); });

  it('cargar registra lo creado y no lo que ya existía (grupo Sabores del seed base)', () => {
    const grupoBase = db.select().from(schema.grupo_modificador).all().find((g) => g.nombre === 'Sabores');
    runDemoHeladeriaSeed(db);
    const reg = db.select().from(schema.demo_registro).all();
    expect(reg.some((r) => r.tabla === 'articulo')).toBe(true);
    expect(reg.some((r) => r.tabla === 'producto_venta')).toBe(true);
    expect(reg.some((r) => r.tabla === 'grupo_modificador_opcion')).toBe(true);
    if (grupoBase) expect(reg.some((r) => r.tabla === 'grupo_modificador' && r.registro_id === grupoBase.id)).toBe(false);
    const e = estadoDemo(db);
    expect(e).toMatchObject({ hayDemo: true, hayCatalogo: true, enUso: [] });
    expect(e.articulosDemo).toBeGreaterThan(0);
    expect(e.productosDemo).toBe(8);
  });

  it('si el seed falla a mitad no queda nada creado ni registrado', () => {
    const espia = vi.spyOn(produccion, 'produccionCrearHandler').mockImplementation(() => { throw new Error('BOOM'); });
    const antes = nombres(db).length;
    expect(() => runDemoHeladeriaSeed(db)).toThrow('BOOM');
    espia.mockRestore();
    expect(nombres(db)).toHaveLength(antes);
    expect(db.select().from(schema.demo_registro).all()).toHaveLength(0);
    expect(db.select().from(schema.producto_venta).all()).toHaveLength(0);
  });

  it('vaciar sin uso borra todo lo demo y deja lo cargado a mano', () => {
    const propio = articuloCreateHandler(db, { nombre: 'Mío', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
    runDemoHeladeriaSeed(db);
    const r = vaciarDemo(db);
    expect(r.articulos).toBeGreaterThan(0);
    expect(r.productos).toBe(8);
    expect(db.select().from(schema.producto_venta).all()).toHaveLength(0);
    expect(db.select().from(schema.articulo).all().map((a) => a.id)).toEqual([propio.id]);
    expect(db.select().from(schema.demo_registro).all()).toHaveLength(0);
    expect(estadoDemo(db)).toMatchObject({ hayDemo: false, hayCatalogo: false });
  });

  it('vaciar con una venta posterior → DEMO_EN_USO:ventas y nada se borra', () => {
    runDemoHeladeriaSeed(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const palito = db.select().from(schema.producto_venta).all().find((p) => p.nombre === 'Palito')!;
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
      lineas: [{ producto_venta_id: palito.id, cantidad: 1 }],
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 120000 }],
    });
    expect(estadoDemo(db).enUso).toContain('ventas');
    expect(() => vaciarDemo(db)).toThrow(/^DEMO_EN_USO:.*ventas/);
    expect(db.select().from(schema.producto_venta).all()).toHaveLength(8);
    expect(db.select().from(schema.demo_registro).all().length).toBeGreaterThan(0);
  });

  it('vaciar con una compra posterior de un insumo demo → DEMO_EN_USO:compras', () => {
    runDemoHeladeriaSeed(db);
    const leche = db.select().from(schema.articulo).all().find((a) => a.nombre === 'Leche')!;
    compraCrearHandler(db, { items: [{ articulo_id: leche.id, cantidad: 5, costo_unitario_centavos: 100 }] });
    expect(() => vaciarDemo(db)).toThrow(/^DEMO_EN_USO:.*compras/);
  });

  it('vaciar con un ajuste de stock posterior → DEMO_EN_USO:movimientos', () => {
    runDemoHeladeriaSeed(db);
    const azucar = db.select().from(schema.articulo).all().find((a) => a.nombre === 'Azúcar')!;
    movimientoArticuloCreateHandler(db, { articulo_id: azucar.id, motivo: 'merma', cantidad: 1 });
    expect(() => vaciarDemo(db)).toThrow(/^DEMO_EN_USO:.*movimientos/);
  });

  it('vaciar con una receta propia que usa un insumo demo → DEMO_EN_USO:recetas', () => {
    runDemoHeladeriaSeed(db);
    const leche = db.select().from(schema.articulo).all().find((a) => a.nombre === 'Leche')!;
    const flan = articuloCreateHandler(db, { nombre: 'Flan', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
    recetaProduccionSetHandler(db, { articulo_id: flan.id, rinde_cantidad: 1, items: [{ articulo_id: leche.id, cantidad: 1 }] });
    expect(() => vaciarDemo(db)).toThrow(/^DEMO_EN_USO:.*recetas/);
    expect(db.select().from(schema.receta_produccion).where(eq(schema.receta_produccion.articulo_id, flan.id)).all()).toHaveLength(1);
  });
});
