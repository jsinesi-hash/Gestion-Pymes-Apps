// packages/client/src/main/ipc/__tests__/dashboard-caja-rango.handlers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler } from '@core/main';
import { ventaConfirmarHandler, type VentaConfirmarPayload } from '../venta';
import { dashboardCajaRangoHandler } from '../dashboard-caja-rango';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function crearProductoYCaja(db: Db) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 1000,
  });
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
  return { prod, caja };
}

function makeEfectivoPayload(cajaId: string, prodId: string, total = 1000): VentaConfirmarPayload {
  return {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: prodId, descripcion: 'Prod', cantidad: 1, precio_unitario: total, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: total * 100, recargo_pct: 0, recargo_centavos: 0 }],
  };
}

function makeTarjetaPayload(cajaId: string, prodId: string, total = 2000, recargoPct = 5): VentaConfirmarPayload {
  const recargoCentavos = Math.round(total * 100 * recargoPct / 100);
  return {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: prodId, descripcion: 'Prod', cantidad: 2, precio_unitario: total / 2, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'tarjeta', monto_centavos: total * 100, recargo_pct: recargoPct, recargo_centavos: recargoCentavos }],
  };
}

describe('dashboardCajaRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin cajas en el período devuelve arrays vacíos', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(0);
    expect(r.por_medio_pago).toHaveLength(0);
    expect(r.recargo_tarjeta_total).toBe(0);
  });

  it('agrega ingresos y egresos por turno', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(1);
    expect(r.turnos[0].ingresos).toBeGreaterThan(0);
    expect(r.turnos[0].egresos).toBe(0);
  });

  it('breakdown por medio de pago: efectivo y tarjeta separados', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    ventaConfirmarHandler(db, makeTarjetaPayload(caja.id, prod.id, 2000, 5));
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    const medios = r.por_medio_pago.map(m => m.medio_pago);
    expect(medios).toContain('efectivo');
    expect(medios).toContain('tarjeta');
  });

  it('KPI recargo_tarjeta_total suma solo recargos de tarjeta', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeTarjetaPayload(caja.id, prod.id, 2000, 5)); // recargo 5% = $100
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.recargo_tarjeta_total).toBeCloseTo(100, 0); // 5% de $2000 = $100
  });

  it('período fuera de rango no devuelve datos de hoy', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    const ayer = new Date(Date.now() - 86400000);
    const desde = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate() - 1, 0, 0, 0, 0);
    const hasta = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate() - 1, 23, 59, 59, 999);
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(0);
  });
});
