import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados } from '../../catalog/seed';
import { articuloCreateHandler } from '../articulo';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import {
  demoHeladeriaSeedHandler, demoEstadoHandler, demoVaciarHandler, registerDemoCatalogHandlers,
} from '../demo-catalog';

type Db = ReturnType<typeof setupDb>;

describe('demo-catalog handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); runCatalogSeedElaborados(db); });

  it('siembra el catálogo demo bajo demanda y devuelve el estado', () => {
    loginAsAdmin(db);
    const r = demoHeladeriaSeedHandler(db);
    expect(r).toMatchObject({ cargado: true, yaHabiaCatalogo: false });
    expect(r.estado).toMatchObject({ hayCatalogo: true, hayDemo: true, enUso: [] });
    expect(db.select().from(schema.categoria_venta).all().length).toBeGreaterThan(0);
  });

  it('no siembra si ya hay productos de venta', () => {
    loginAsAdmin(db);
    demoHeladeriaSeedHandler(db);
    const cantidad = db.select().from(schema.articulo).all().length;
    const r = demoHeladeriaSeedHandler(db);
    expect(r).toMatchObject({ cargado: false, yaHabiaCatalogo: true });
    expect(db.select().from(schema.articulo).all()).toHaveLength(cantidad);
  });

  it('estado: vacío al inicio', () => {
    loginAsAdmin(db);
    expect(demoEstadoHandler(db)).toEqual({ hayCatalogo: false, hayDemo: false, articulosDemo: 0, productosDemo: 0, enUso: [] });
  });

  it('vaciar elimina lo demo, conserva lo propio y deja el estado limpio', () => {
    loginAsAdmin(db);
    const propio = articuloCreateHandler(db, { nombre: 'Mío', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false });
    demoHeladeriaSeedHandler(db);
    const r = demoVaciarHandler(db);
    expect(r.eliminados).toBeGreaterThan(0);
    expect(r.estado).toMatchObject({ hayCatalogo: false, hayDemo: false });
    expect(db.select().from(schema.articulo).all().map((a) => a.id)).toEqual([propio.id]);
  });

  it('vaciar con uso real → DEMO_EN_USO y el estado lo informa', () => {
    loginAsAdmin(db);
    demoHeladeriaSeedHandler(db);
    const azucar = db.select().from(schema.articulo).all().find((a) => a.nombre === 'Azúcar')!;
    movimientoArticuloCreateHandler(db, { articulo_id: azucar.id, motivo: 'merma', cantidad: 1 });
    expect(demoEstadoHandler(db).enUso).toContain('movimientos');
    expect(() => demoVaciarHandler(db)).toThrow(/^DEMO_EN_USO:.*movimientos/);
    expect(db.select().from(schema.producto_venta).all().length).toBeGreaterThan(0);
  });

  it('exige sesión de un usuario con permiso de administración', () => {
    clearSession();
    expect(() => demoHeladeriaSeedHandler(db)).toThrow('UNAUTHENTICATED');
    expect(() => demoEstadoHandler(db)).toThrow('UNAUTHENTICATED');
    expect(() => demoVaciarHandler(db)).toThrow('UNAUTHENTICATED');
  });

  it('registra los tres canales demo-catalog:*', () => {
    const handle = vi.fn();
    registerDemoCatalogHandlers({ handle } as never, db);
    expect(handle.mock.calls.map((c) => c[0]).sort()).toEqual([
      'demo-catalog:estado', 'demo-catalog:seed-heladeria', 'demo-catalog:vaciar',
    ]);
  });
});
