import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler } from '../caja';
import { ventaConfirmarHandler, type VentaConfirmarPayload } from '../venta';
import { clienteUpsertHandler } from '@core/main';
import { dashboardClientesRangoHandler, dashboardClientesEstadoHandler } from '../dashboard-clientes';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function setupCatalog(db: Db) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 1000,
  });
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
  return { prod, caja };
}

function crearClienteConCCC(db: Db, nombre: string, saldo_centavos: number, diasAtras = 0) {
  // clienteUpsertHandler crea automáticamente la CCC cuando habilita_cuenta_corriente=true
  const { id } = clienteUpsertHandler(db, {
    tipo_documento: 'DNI',
    numero_documento: `${Math.floor(Math.random() * 90000000) + 10000000}`,
    nombre,
    apellido: '(revisar)',
    condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: true,
  });
  // Actualizar la CCC ya creada con el saldo y fecha_ultimo_movimiento deseados
  const fechaMov = new Date(Date.now() - diasAtras * 86400000);
  db.update(schema.cuenta_corriente_cliente).set({
    saldo_centavos,
    fecha_ultimo_movimiento: fechaMov,
    updated_at: new Date(),
  }).where(eq(schema.cuenta_corriente_cliente.cliente_id, id)).run();
  return id;
}

function makeVentaPayload(cajaId: string, clienteId: string, prodId: string, total = 1000): VentaConfirmarPayload {
  return {
    caja_id: cajaId, cliente_id: clienteId,
    lineas: [{ producto_id: prodId, descripcion: 'P', cantidad: 1, precio_unitario: total, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: total * 100, recargo_pct: 0, recargo_centavos: 0 }],
  };
}

describe('dashboardClientesRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas en el período devuelve ranking vacío y clientes_nuevos=0', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.ranking).toHaveLength(0);
    expect(r.clientes_nuevos).toBe(0);
  });

  it('ranking ordena por total_facturado desc', () => {
    const { prod, caja } = setupCatalog(db);
    const c1 = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '11111111', nombre: 'Cliente', apellido: 'A', condicion_fiscal: 'Consumidor Final' });
    const c2 = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '22222222', nombre: 'Cliente', apellido: 'B', condicion_fiscal: 'Consumidor Final' });
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c1.id, prod.id, 3000));
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c2.id, prod.id, 5000));
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.ranking[0].nombre_completo).toBe('Cliente B');
    expect(r.ranking[0].total_facturado).toBe(5000);
    expect(r.ranking[1].total_facturado).toBe(3000);
  });

  it('clientes_nuevos cuenta clientes creados hoy', () => {
    loginAsAdmin(db);
    clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '33333333', nombre: 'Nuevo', apellido: '(revisar)', condicion_fiscal: 'Consumidor Final' });
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.clientes_nuevos).toBeGreaterThanOrEqual(1);
  });
});

describe('dashboardClientesEstadoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin CCC devuelve todo en cero', () => {
    loginAsAdmin(db);
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBe(0);
    expect(r.deuda_vencida).toBe(0);
    expect(r.clientes_inactivos).toBe(0);
  });

  it('deuda_total suma saldo de CCCs activas con saldo positivo', () => {
    loginAsAdmin(db);
    crearClienteConCCC(db, 'A', 150000, 5);  // $1500 con mov hace 5 días
    crearClienteConCCC(db, 'B', 50000, 5);   // $500  con mov hace 5 días
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBeCloseTo(2000, 0);
  });

  it('deuda_vencida solo incluye CCCs con fecha_ultimo_movimiento más antigua que cc_dias_vencimiento (30)', () => {
    loginAsAdmin(db);
    crearClienteConCCC(db, 'Reciente',  100000, 10); // mov hace 10 días → no vencido
    crearClienteConCCC(db, 'Vencido',   200000, 40); // mov hace 40 días → vencido (param=30)
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBeCloseTo(3000, 0);
    expect(r.deuda_vencida).toBeCloseTo(2000, 0);
  });

  it('clientes_inactivos excluye clientes con compra reciente', () => {
    const { prod, caja } = setupCatalog(db);
    const c = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '44444444', nombre: 'Activo', apellido: '(revisar)', condicion_fiscal: 'Consumidor Final' });
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c.id, prod.id, 1000));
    const r = dashboardClientesEstadoHandler(db);
    // c tiene compra de hoy → no debe ser inactivo
    expect(r.clientes_inactivos).toBe(0);
  });
});
