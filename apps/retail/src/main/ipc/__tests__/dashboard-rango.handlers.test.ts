import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler } from '@core/main';
import { ventaConfirmarHandler, type VentaConfirmarPayload } from '../venta';
import {
  dashboardVentasKpisRangoHandler,
  dashboardVentasEvolucionHandler,
  dashboardVentasHeatmapHandler,
  dashboardVentasDiaMesHandler,
  dashboardVentasVendedorHandler,
  dashboardProductosAbcHandler,
  dashboardProductosMargenCategoriaHandler,
} from '../dashboard-rango';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function crearProducto(db: Db, nombre = 'Tornillo', precio = 1000, costo = 400) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: precio,
  });
  db.update(schema.producto).set({ precio_costo_promedio: costo }).where(eq(schema.producto.id, prod.id)).run();
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  return { prod, cat, imp };
}

function makePayload(cajaId: string, prodId: string, cantidad = 1, precio = 1000, alicuota = 21): VentaConfirmarPayload {
  const total = precio * cantidad;
  return {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: prodId, descripcion: 'Prod', cantidad, precio_unitario: precio, descuento_linea: 0, alicuota_iva: alicuota, subtotal: total }],
    descuento_global: 0, subtotal: total,
    importe_iva: Math.round(total * alicuota / (100 + alicuota) * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: Math.round(total * 100) }],
  };
}

// ─── dashboardVentasKpisRangoHandler ─────────────────────────────────────────

describe('dashboardVentasKpisRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('rango sin ventas devuelve ceros', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardVentasKpisRangoHandler(db, { desde, hasta, categoria_id: null, producto_id: null });
    expect(r.total).toBe(0);
    expect(r.count).toBe(0);
    expect(r.ticket_promedio).toBe(0);
    expect(r.por_forma_pago).toHaveLength(0);
    expect(r.top_cantidad).toHaveLength(0);
  });

  it('cuenta ventas confirmadas del rango', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 2000));
    const { desde, hasta } = todayRange();
    const r = dashboardVentasKpisRangoHandler(db, { desde, hasta, categoria_id: null, producto_id: null });
    expect(r.count).toBe(2);
    expect(r.total).toBe(3000);
    expect(r.ticket_promedio).toBeCloseTo(1500, 2);
  });

  it('filtro categoria_id devuelve solo ventas con productos de esa categoría', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const catA = categoriaCreateHandler(db, { nombre: 'CatA' });
    const catB = categoriaCreateHandler(db, { nombre: 'CatB' });
    const pA = productoCreateHandler(db, { nombre_corto: 'ProdA', categoria_id: catA.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 500 });
    const pB = productoCreateHandler(db, { nombre_corto: 'ProdB', categoria_id: catB.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 800 });
    stockEntradaHandler(db, { producto_id: pA.id, cantidad: 10 });
    stockEntradaHandler(db, { producto_id: pB.id, cantidad: 10 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, pA.id, 1, 500, 0));
    ventaConfirmarHandler(db, makePayload(caja.id, pB.id, 1, 800, 0));
    const { desde, hasta } = todayRange();
    const r = dashboardVentasKpisRangoHandler(db, { desde, hasta, categoria_id: catA.id, producto_id: null });
    expect(r.count).toBe(1);
    expect(r.total).toBe(500);
  });

  it('filtro categoria_id sin ventas devuelve ceros sin error', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardVentasKpisRangoHandler(db, { desde, hasta, categoria_id: 'cat-inexistente', producto_id: null });
    expect(r.total).toBe(0);
    expect(r.count).toBe(0);
  });
});

// ─── dashboardVentasEvolucionHandler ─────────────────────────────────────────

describe('dashboardVentasEvolucionHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('rango de 1 día → 24 puntos horarios', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const ayer_d = new Date(desde.getTime() - 86400000);
    const ayer_h = new Date(hasta.getTime() - 86400000);
    const r = dashboardVentasEvolucionHandler(db, { desde, hasta, desde_anterior: ayer_d, hasta_anterior: ayer_h });
    expect(r).toHaveLength(24);
    expect(r[0].label).toBe('0h');
    expect(r[23].label).toBe('23h');
    r.forEach(p => { expect(p.actual).toBe(0); expect(p.anterior).toBe(0); });
  });

  it('venta de hoy aparece en la hora correcta del actual', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
    const { desde, hasta } = todayRange();
    const ayer_d = new Date(desde.getTime() - 86400000);
    const ayer_h = new Date(hasta.getTime() - 86400000);
    const r = dashboardVentasEvolucionHandler(db, { desde, hasta, desde_anterior: ayer_d, hasta_anterior: ayer_h });
    const totalActual = r.reduce((s, p) => s + p.actual, 0);
    expect(totalActual).toBeCloseTo(1000, 1);
  });

  it('rango de 7 días → puntos diarios con label Día 1', () => {
    loginAsAdmin(db);
    const hasta = new Date();
    hasta.setHours(23, 59, 59, 999);
    const desde = new Date(hasta.getTime() - 6 * 86400000);
    desde.setHours(0, 0, 0, 0);
    const hasta_ant = new Date(desde.getTime() - 1);
    const desde_ant = new Date(hasta_ant.getTime() - 6 * 86400000);
    desde_ant.setHours(0, 0, 0, 0);
    const r = dashboardVentasEvolucionHandler(db, { desde, hasta, desde_anterior: desde_ant, hasta_anterior: hasta_ant });
    // El handler usa Math.ceil(diffMs/86400000)+1, por lo que un rango de 7 días produce 8 puntos
    expect(r.length).toBeGreaterThanOrEqual(7);
    expect(r[0].label).toBe('Día 1');
  });
});

// ─── dashboardVentasHeatmapHandler ───────────────────────────────────────────

describe('dashboardVentasHeatmapHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas devuelve array vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardVentasHeatmapHandler(db, { desde, hasta });
    expect(r).toHaveLength(0);
  });

  it('venta de hoy aparece con hora y dia_semana correctos', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
    const { desde, hasta } = todayRange();
    const r = dashboardVentasHeatmapHandler(db, { desde, hasta });
    expect(r).toHaveLength(1);
    expect(r[0].hora).toBeGreaterThanOrEqual(0);
    expect(r[0].hora).toBeLessThanOrEqual(23);
    expect(r[0].dia_semana).toBeGreaterThanOrEqual(0);
    expect(r[0].dia_semana).toBeLessThanOrEqual(6);
    expect(r[0].total).toBeCloseTo(1000, 1);
  });
});

// ─── dashboardVentasDiaMesHandler ────────────────────────────────────────────

describe('dashboardVentasDiaMesHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas devuelve array vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    expect(dashboardVentasDiaMesHandler(db, { desde, hasta })).toHaveLength(0);
  });

  it('venta de hoy tiene dia correcto (1-31)', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 500));
    const { desde, hasta } = todayRange();
    const r = dashboardVentasDiaMesHandler(db, { desde, hasta });
    expect(r).toHaveLength(1);
    expect(r[0].dia).toBe(new Date().getDate());
    expect(r[0].total).toBeCloseTo(500, 1);
  });
});

// ─── dashboardVentasVendedorHandler ──────────────────────────────────────────

describe('dashboardVentasVendedorHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas devuelve array vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    expect(dashboardVentasVendedorHandler(db, { desde, hasta })).toHaveLength(0);
  });

  it('devuelve el usuario con su nombre y total de ventas', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 2000));
    const { desde, hasta } = todayRange();
    const r = dashboardVentasVendedorHandler(db, { desde, hasta });
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBeTruthy();
    expect(r[0].total).toBeCloseTo(3000, 1);
    expect(r[0].count).toBe(2);
  });
});

// ─── dashboardProductosAbcHandler ────────────────────────────────────────────

describe('dashboardProductosAbcHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas devuelve array vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    expect(dashboardProductosAbcHandler(db, { desde, hasta })).toHaveLength(0);
  });

  it('clasifica A al producto dominante y C al menor cuando pGrande <= 80% del total', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'C' });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const pGrande = productoCreateHandler(db, { nombre_corto: 'Grande', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 800 });
    const pChico  = productoCreateHandler(db, { nombre_corto: 'Chico',  categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 500 });
    stockEntradaHandler(db, { producto_id: pGrande.id, cantidad: 100 });
    stockEntradaHandler(db, { producto_id: pChico.id,  cantidad: 100 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    // pGrande: 10 × 800 = 8000 (76.2% del total 10500) → clase A (pct_acumulado <= 80)
    // pChico:   5 × 500 = 2500 (100% acumulado) → clase C (pct_acumulado > 95)
    ventaConfirmarHandler(db, makePayload(caja.id, pGrande.id, 10, 800, 0));
    ventaConfirmarHandler(db, makePayload(caja.id, pChico.id,   5, 500, 0));
    const { desde, hasta } = todayRange();
    const r = dashboardProductosAbcHandler(db, { desde, hasta });
    expect(r[0].producto_id).toBe(pGrande.id);
    expect(r[0].clase).toBe('A');
    expect(r[r.length - 1].clase).toBe('C');
  });
});

// ─── dashboardProductosMargenCategoriaHandler ────────────────────────────────

describe('dashboardProductosMargenCategoriaHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas devuelve array vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    expect(dashboardProductosMargenCategoriaHandler(db, { desde, hasta })).toHaveLength(0);
  });

  it('calcula margen por categoría correctamente', () => {
    // precio_venta=121 IVA inc, iva=21%, neto=100, costo=50 → margen/u=50
    const { prod, cat } = crearProducto(db, 'Prod', 121, 50);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 2, 121, 21));
    const { desde, hasta } = todayRange();
    const r = dashboardProductosMargenCategoriaHandler(db, { desde, hasta });
    expect(r).toHaveLength(1);
    expect(r[0].categoria_id).toBe(cat.id);
    expect(r[0].margen_total).toBeCloseTo(100, 1);
    expect(r[0].revenue).toBeGreaterThan(0);
  });
});
