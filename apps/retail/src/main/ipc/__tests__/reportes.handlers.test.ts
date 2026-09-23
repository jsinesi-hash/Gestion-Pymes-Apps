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
  detalleVentasHandler,
  reporteVentasQueryAll,
  reporteVentasDetalleQueryAll,
  type ReporteVentasFiltros,
} from '../reportes';

type Db = ReturnType<typeof setupDb>;
const CF_ID = 'cf000000-0000-0000-0000-000000000001';

function crearProducto(db: Db, nombre = 'Tubo', precio = 1000) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cañería' });
  const imp = db.select().from(schema.impuesto)
    .where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: nombre,
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: 'u',
    precio_venta_lista: precio,
  });
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  return { prod, cat, imp };
}

function makePayload(
  cajaId: string,
  prodId: string,
  opts: {
    precio?: number;
    cantidad?: number;
    medioPago?: VentaConfirmarPayload['pagos'][0]['medio_pago'];
  } = {}
): VentaConfirmarPayload {
  const precio = opts.precio ?? 1000;
  const cantidad = opts.cantidad ?? 1;
  const total = precio * cantidad;
  return {
    caja_id: cajaId,
    cliente_id: CF_ID,
    lineas: [{
      producto_id: prodId, descripcion: 'Test',
      cantidad, precio_unitario: precio,
      descuento_linea: 0, alicuota_iva: 21, subtotal: total,
    }],
    descuento_global: 0,
    subtotal: total,
    importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total,
    ajuste_redondeo: 0,
    pagos: [{ medio_pago: opts.medioPago ?? 'efectivo', monto_centavos: Math.round(total * 100) }],
  };
}

describe('detalleVentasHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin filtros devuelve ventas confirmadas paginadas', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 1000 }));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 2000 }));

    const r = detalleVentasHandler(db, {}, 1, 100);
    expect(r.total).toBe(2);
    expect(r.rows).toHaveLength(2);
    expect(r.page).toBe(1);
    expect(r.totalPages).toBe(1);
    expect(r.totalImporte).toBeCloseTo(3000, 0);
  });

  it('excluye ventas no confirmadas', () => {
    const { prod } = crearProducto(db);
    const session = loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    // Insertar una venta en borrador directamente con usuario_id real
    db.insert(schema.venta).values({
      id: generateId(),
      numero_interno: 'V-C1-B1',
      fecha: new Date(),
      cliente_id: CF_ID,
      usuario_id: session.id,
      caja_id: caja.id,
      subtotal: 0,
      descuento_global: 0,
      importe_iva: 0,
      total: 0,
      ajuste_redondeo: 0,
      forma_pago: 'efectivo',
      estado: 'borrador',
      usuario_creacion_id: session.id,
      fecha_creacion: new Date(),
      origin_id: 'test',
      updated_at: new Date(),
    }).run();

    const r = detalleVentasHandler(db, {}, 1, 100);
    expect(r.total).toBe(1);
  });

  it('filtra por fechaDesde y fechaHasta', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const rHoy = detalleVentasHandler(db, { fechaHasta: new Date() }, 1, 100);
    expect(rHoy.total).toBe(1);

    const rFuturo = detalleVentasHandler(db, { fechaDesde: manana }, 1, 100);
    expect(rFuturo.total).toBe(0);
  });

  it('el filtro de un solo día cubre ese día local completo (00:00 a 23:59)', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const temprana = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
    const tardia   = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    // Dos ventas en los extremos del mismo día local.
    db.update(schema.venta).set({ fecha: new Date(2026, 0, 15, 0, 15) })
      .where(eq(schema.venta.id, temprana.venta.id)).run();
    db.update(schema.venta).set({ fecha: new Date(2026, 0, 15, 23, 45) })
      .where(eq(schema.venta.id, tardia.venta.id)).run();

    // El usuario elige "15/01": el handler debe tomarlo como el día entero,
    // sea cual sea la hora del instante que recibe.
    const mediodia = new Date(2026, 0, 15, 12, 0);
    const r = detalleVentasHandler(db, { fechaDesde: mediodia, fechaHasta: mediodia }, 1, 100);

    expect(r.total).toBe(2);
  });

  it('el filtro de un día no arrastra ventas de los días vecinos', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const anterior = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
    const delDia   = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
    const siguiente = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    db.update(schema.venta).set({ fecha: new Date(2026, 0, 14, 23, 45) })
      .where(eq(schema.venta.id, anterior.venta.id)).run();
    db.update(schema.venta).set({ fecha: new Date(2026, 0, 15, 10, 0) })
      .where(eq(schema.venta.id, delDia.venta.id)).run();
    db.update(schema.venta).set({ fecha: new Date(2026, 0, 16, 0, 15) })
      .where(eq(schema.venta.id, siguiente.venta.id)).run();

    const dia = new Date(2026, 0, 15, 12, 0);
    const r = detalleVentasHandler(db, { fechaDesde: dia, fechaHasta: dia }, 1, 100);

    expect(r.total).toBe(1);
  });

  it('filtra por clienteId', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    expect(detalleVentasHandler(db, { clienteId: CF_ID }, 1, 100).total).toBe(1);
    expect(detalleVentasHandler(db, { clienteId: 'no-existe' }, 1, 100).total).toBe(0);
  });

  it('filtra por categoriaId con EXISTS subquery', () => {
    const { prod, cat } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    expect(detalleVentasHandler(db, { categoriaId: cat.id }, 1, 100).total).toBe(1);
    expect(detalleVentasHandler(db, { categoriaId: 'cat-no-existe' }, 1, 100).total).toBe(0);
  });

  it('filtra por productoTexto (LIKE en nombre_corto)', () => {
    const { prod } = crearProducto(db, 'Tornillo Especial');
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    expect(detalleVentasHandler(db, { productoTexto: 'Tornillo' }, 1, 100).total).toBe(1);
    expect(detalleVentasHandler(db, { productoTexto: 'xyz999' }, 1, 100).total).toBe(0);
  });

  it('filtra por medioPago con EXISTS subquery', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { medioPago: 'tarjeta' }));

    expect(detalleVentasHandler(db, { medioPago: 'tarjeta' }, 1, 100).total).toBe(1);
    expect(detalleVentasHandler(db, { medioPago: 'efectivo' }, 1, 100).total).toBe(0);
  });

  it('pagina correctamente', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 1000 }));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 2000 }));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 3000 }));

    const p1 = detalleVentasHandler(db, {}, 1, 2);
    expect(p1.total).toBe(3);
    expect(p1.rows).toHaveLength(2);
    expect(p1.totalPages).toBe(2);
    expect(p1.page).toBe(1);

    const p2 = detalleVentasHandler(db, {}, 2, 2);
    expect(p2.rows).toHaveLength(1);
    expect(p2.page).toBe(2);
    expect(p2.rows[0].numero_interno).not.toBe(p1.rows[0].numero_interno);
  });

  it('incluye medios_pago concatenados para pago mixto', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const total = 2000;
    const payload: VentaConfirmarPayload = {
      caja_id: caja.id, cliente_id: CF_ID,
      lineas: [{ producto_id: prod.id, descripcion: 'Test', cantidad: 1,
        precio_unitario: total, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
      descuento_global: 0, subtotal: total, importe_iva: 0, total, ajuste_redondeo: 0,
      pagos: [
        { medio_pago: 'efectivo', monto_centavos: 100000 },
        { medio_pago: 'tarjeta',  monto_centavos: 100000 },
      ],
    };
    ventaConfirmarHandler(db, payload);

    const r = detalleVentasHandler(db, {}, 1, 100);
    expect(r.rows[0].medios_pago).toContain('efectivo');
    expect(r.rows[0].medios_pago).toContain('tarjeta');
  });

  it('rows incluyen los campos requeridos', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    const r = detalleVentasHandler(db, {}, 1, 100);
    const row = r.rows[0];
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('numero_interno');
    expect(row).toHaveProperty('fecha');
    expect(row).toHaveProperty('cliente_nombre_completo');
    expect(row).toHaveProperty('vendedor_nombre');
    expect(row).toHaveProperty('medios_pago');
    expect(row).toHaveProperty('subtotal');
    expect(row).toHaveProperty('importe_iva');
    expect(row).toHaveProperty('total');
  });
});

describe('reporteVentasQueryAll', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('devuelve todas las filas sin paginación', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    for (let i = 0; i < 5; i++) {
      ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 1000 + i * 100 }));
    }
    const rows = reporteVentasQueryAll(db, {});
    expect(rows).toHaveLength(5);
  });
});

describe('reporteVentasDetalleQueryAll', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('devuelve una fila por venta_detalle con campos de producto y categoria', () => {
    const { prod } = crearProducto(db, 'Tubo PVC');
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, { precio: 500, cantidad: 3 }));

    const rows = reporteVentasDetalleQueryAll(db, {});
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.sku).toBe(prod.sku);
    expect(row.descripcion).toBe('Test');
    expect(row.categoria_nombre).toBe('Cañería');
    expect(row.cantidad).toBe(3);
    expect(row.precio_unitario).toBe(500);
    expect(row.subtotal_linea).toBeCloseTo(1500, 0);
    expect(row.total_venta).toBeCloseTo(1500, 0);
  });

  it('respeta filtro de categoria', () => {
    const { prod, cat } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

    expect(reporteVentasDetalleQueryAll(db, { categoriaId: cat.id })).toHaveLength(1);
    expect(reporteVentasDetalleQueryAll(db, { categoriaId: 'no-existe' })).toHaveLength(0);
  });
});
