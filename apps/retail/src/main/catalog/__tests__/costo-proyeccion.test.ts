import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { cajaAbrirHandler } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import { stockEntradaHandler, stockAjusteHandler } from '../../ipc/stock';
import { ventaConfirmarHandler } from '../../ipc/venta';
import { validarProductos, confirmarProductos } from '../../ipc/importar';
import { runDemoCatalogSeed } from '../../base-seed/demo-catalog';
import { seedCatalog } from '../../dev-seed/catalog';
import {
  diferenciasDeCostoPromedio, proyectarCostoPromedio, recalcularCostoPromedio,
} from '../stock-proyeccion';

// ADR-151 (corrección de F1 PR1): el costo promedio ponderado se deriva del libro.
const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const MIGRACION_0057 = path.resolve(__dirname, '../../db/migrations/0057_adr151_costo_sin_movimiento.sql');

describe('proyección del costo promedio (Retail)', () => {
  let db: ReturnType<typeof setupDb>;
  const cpp = (id: string) => db.select().from(schema.producto).where(eq(schema.producto.id, id)).get()!.precio_costo_promedio;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function producto(nombre: string, stock_inicial?: { cantidad: number; costo: number }) {
    const cat = categoriaCreateHandler(db, { nombre: `Cat ${nombre}` });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    return productoCreateHandler(db, {
      nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 1000,
      ...(stock_inicial ? { stock_inicial } : {}),
    });
  }

  it('alta con costo, entradas con y sin costo, ventas y conteos: el guardado coincide con la proyección', () => {
    const a = producto('A', { cantidad: 10, costo: 100 });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10, costo_unitario: 200 }); // 150
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: a.id, descripcion: 'x', cantidad: 5, precio_unitario: 1000, descuento_linea: 0, alicuota_iva: 21, subtotal: 5000 }],
      descuento_global: 0, subtotal: 5000, importe_iva: 867.77, total: 5000, ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 500_000 }],
    });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 5, costo_unitario: 300 }); // (15·150 + 5·300) / 20
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 3 }); // sin costo: no cambia el promedio
    stockAjusteHandler(db, { producto_id: a.id, cantidad_contada: 4, observaciones: 'conteo' });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 4, costo_unitario: 100 }); // (4·187.5 + 4·100) / 8

    expect(cpp(a.id)).toBeCloseTo(143.75, 9);
    expect(proyectarCostoPromedio(db, a.id)).toBeCloseTo(cpp(a.id), 9);
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
  });

  it('un producto importado con costo y sin stock deja un movimiento que fija ese costo', () => {
    categoriaCreateHandler(db, { nombre: 'Herramientas' });
    const csv = 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro,costo\nPinza,u,900,21,Herramientas,450';
    confirmarProductos(db, { rows: validarProductos(db, { csv }).rows });
    const pinza = db.select().from(schema.producto).where(eq(schema.producto.nombre_corto, 'Pinza')).get()!;
    expect(pinza.precio_costo_promedio).toBe(450);
    const movs = db.select().from(schema.movimiento_stock).where(eq(schema.movimiento_stock.producto_id, pinza.id)).all();
    expect(movs).toMatchObject([{ tipo: 'entrada', motivo: 'inicial', cantidad: 0, costo_unitario: 450 }]);
    expect(proyectarCostoPromedio(db, pinza.id)).toBe(450);
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
  });

  it('migración 0057: un producto viejo con costo y sin entradas con costo recibe el movimiento que lo fija', () => {
    const a = producto('Legado');
    db.update(schema.producto).set({ precio_costo_promedio: 2908 }).where(eq(schema.producto.id, a.id)).run();
    expect(diferenciasDeCostoPromedio(db)).toEqual([{ producto_id: a.id, guardado: 2908, proyectado: 0 }]);

    const sqlite = db.$client;
    sqlite.exec(fs.readFileSync(MIGRACION_0057, 'utf8'));
    sqlite.exec(fs.readFileSync(MIGRACION_0057, 'utf8')); // idempotente: no duplica
    const fijaciones = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.producto_id, a.id)).all().filter((m) => m.costo_unitario === 2908);
    expect(fijaciones).toHaveLength(1);
    expect(fijaciones[0]).toMatchObject({ tipo: 'entrada', motivo: 'inicial', cantidad: 0 });
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
  });

  it('recalcular corrige un costo desfasado; si cuadra no toca la fila', () => {
    const a = producto('A', { cantidad: 2, costo: 50 });
    expect(recalcularCostoPromedio(db, a.id)).toEqual({ guardado: 50, proyectado: 50, corregido: false });
    db.update(schema.producto).set({ precio_costo_promedio: 77 }).where(eq(schema.producto.id, a.id)).run();
    expect(recalcularCostoPromedio(db, a.id)).toEqual({ guardado: 77, proyectado: 50, corregido: true });
    expect(cpp(a.id)).toBe(50);
  });

  it('el catálogo demo y el seed de desarrollo cuadran', () => {
    runDemoCatalogSeed(db);
    expect(diferenciasDeCostoPromedio(db)).toEqual([]);
    const otra = setupDb();
    runCatalogSeed(otra);
    seedCatalog(otra, false);
    expect(diferenciasDeCostoPromedio(otra)).toEqual([]);
  });
});
