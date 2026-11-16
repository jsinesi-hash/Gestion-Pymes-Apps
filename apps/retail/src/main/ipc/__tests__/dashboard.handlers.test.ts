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
import { dashboardVentasHandler, dashboardStockHandler, dashboardCajaHandler } from '../dashboard';
import { requirePermission, setSession } from '@core/main';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

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
  return { prod, imp };
}

function makePayload(
  cajaId: string, prodId: string,
  cantidad = 1, precio = 1000, alicuota = 21,
): VentaConfirmarPayload {
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

describe('dashboardVentasHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('día sin ventas devuelve todos en cero y arrays vacíos', () => {
    loginAsAdmin(db);
    const result = dashboardVentasHandler(db);
    expect(result.total_dia).toBe(0);
    expect(result.count_dia).toBe(0);
    expect(result.ticket_promedio).toBe(0);
    expect(result.por_hora).toHaveLength(0);
    expect(result.top_cantidad).toHaveLength(0);
  });

  it('cuenta solo ventas confirmadas del día (excluye borrador)', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id)); // confirmada
    const hoy = new Date();
    const userId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
    db.insert(schema.venta).values({
      id: generateId(), numero_interno: 'V-C1-999998',
      fecha: hoy, cliente_id: CF_ID, usuario_id: userId, caja_id: caja.id,
      subtotal: 500, descuento_global: 0, importe_iva: 0, total: 500, ajuste_redondeo: 0,
      forma_pago: 'efectivo', estado: 'borrador',
      usuario_creacion_id: userId, fecha_creacion: hoy,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: hoy,
    }).run();
    const result = dashboardVentasHandler(db);
    expect(result.count_dia).toBe(1);
    expect(result.total_dia).toBe(1000);
  });

  it('excluye ventas de ayer', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id));
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    db.update(schema.venta).set({ fecha: ayer }).run();
    const result = dashboardVentasHandler(db);
    expect(result.count_dia).toBe(0);
    expect(result.total_dia).toBe(0);
  });

  it('ticket_promedio = total / count', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 1000));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 2000));
    const result = dashboardVentasHandler(db);
    expect(result.count_dia).toBe(2);
    expect(result.total_dia).toBe(3000);
    expect(result.ticket_promedio).toBeCloseTo(1500, 2);
  });

  it('por_hora agrupa correctamente (2 ventas en misma hora = 1 slot)', () => {
    const { prod } = crearProducto(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 100));
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 1, 200));
    const result = dashboardVentasHandler(db);
    expect(result.por_hora).toHaveLength(1);
    expect(result.por_hora[0].total).toBeCloseTo(300, 2);
  });

  it('top_cantidad: top 5 ordenado desc por unidades (excluye el 6to)', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'C' });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const prods = Array.from({ length: 6 }, (_, i) => {
      const p = productoCreateHandler(db, { nombre_corto: `P${i}`, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
      stockEntradaHandler(db, { producto_id: p.id, cantidad: 100 });
      return p;
    });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    prods.forEach((p, i) => ventaConfirmarHandler(db, makePayload(caja.id, p.id, 6 - i, 100)));
    const result = dashboardVentasHandler(db);
    expect(result.top_cantidad).toHaveLength(5);
    expect(result.top_cantidad[0].producto_id).toBe(prods[0].id);
    expect(result.top_cantidad[0].cantidad).toBe(6);
    expect(result.top_cantidad[4].producto_id).toBe(prods[4].id);
  });

  it('top_margen: precio neto − costo promedio × cantidad', () => {
    // precio_venta=121 IVA inc., iva=21%, precio_neto=100, costo=50 → margen/u=50, ×2=100
    const { prod } = crearProducto(db, 'Tornillo', 121, 50);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 2, 121, 21));
    const result = dashboardVentasHandler(db);
    expect(result.top_margen).toHaveLength(1);
    expect(result.top_margen[0].margen_estimado).toBeCloseTo(100, 1);
  });
});

describe('dashboardStockHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function crearActivo(db: Db, nombre = 'Prod', costo = 100) {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'C' });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 200,
    });
    db.update(schema.producto).set({ precio_costo_promedio: costo }).where(eq(schema.producto.id, prod.id)).run();
    return prod;
  }

  it('valor_inventario solo considera productos activos', () => {
    const activo   = crearActivo(db, 'Activo', 100);
    const inactivo = crearActivo(db, 'Inactivo', 200);
    stockEntradaHandler(db, { producto_id: activo.id,   cantidad: 5 }); // 5*100=500
    stockEntradaHandler(db, { producto_id: inactivo.id, cantidad: 3 }); // no debe contar
    db.update(schema.producto).set({ activo: false }).where(eq(schema.producto.id, inactivo.id)).run();
    const result = dashboardStockHandler(db);
    expect(result.valor_inventario).toBeCloseTo(500, 1);
  });

  it('sin_stock incluye todos los productos con stock_fisico = 0, con o sin ventas recientes', () => {
    const conVentas = crearActivo(db, 'Con ventas', 50);
    const sinVentas = crearActivo(db, 'Sin ventas', 50);
    stockEntradaHandler(db, { producto_id: conVentas.id, cantidad: 1 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    ventaConfirmarHandler(db, makePayload(caja.id, conVentas.id, 1, 200, 0));
    // conVentas: stock=0, tiene venta reciente
    // sinVentas: sin entrada de stock → existencias con stock_fisico=0, sin ventas
    // Ambos deben aparecer en sin_stock
    const result = dashboardStockHandler(db);
    const ids = result.sin_stock.map(s => s.producto_id);
    expect(ids).toContain(conVentas.id);
    expect(ids).toContain(sinVentas.id);
  });

  it('bajo_minimo incluye dias_hasta_agotar correcto', () => {
    const prod = crearActivo(db, 'Bajo min');
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 5 });
    db.update(schema.existencias).set({ stock_minimo: 10 }).where(eq(schema.existencias.producto_id, prod.id)).run();
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    // Sell 5 to get velocity data, then reset stock to 5 and backdate the sale 15 days
    ventaConfirmarHandler(db, makePayload(caja.id, prod.id, 5, 200, 0));
    // stock is now 0, set it back to 5
    db.update(schema.existencias).set({ stock_fisico: 5 }).where(eq(schema.existencias.producto_id, prod.id)).run();
    // Backdate the sale to 15 days ago (still within 30d window)
    const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    db.update(schema.venta).set({ fecha: hace15 }).run();
    // velocity_30d=5 units in 30d; dias = floor(5 / (5/30)) = floor(30) = 30
    const result = dashboardStockHandler(db);
    expect(result.bajo_minimo).toHaveLength(1);
    expect(result.bajo_minimo[0].dias_hasta_agotar).toBe(30);
  });

  it('bajo_minimo excluye agotados (van en sin_stock) e inactivos', () => {
    const agotado = crearActivo(db, 'Agotado');
    const inactivo = crearActivo(db, 'Inactivo');
    const bajo = crearActivo(db, 'Bajo');
    for (const [p, fisico] of [[agotado, 0], [inactivo, 2], [bajo, 2]] as const) {
      stockEntradaHandler(db, { producto_id: p.id, cantidad: 5 });
      db.update(schema.existencias).set({ stock_fisico: fisico, stock_minimo: 10 }).where(eq(schema.existencias.producto_id, p.id)).run();
    }
    db.update(schema.producto).set({ activo: false }).where(eq(schema.producto.id, inactivo.id)).run();
    const result = dashboardStockHandler(db);
    expect(result.bajo_minimo.map(a => a.producto_id)).toEqual([bajo.id]);
    expect(result.sin_stock.map(a => a.producto_id)).toEqual([agotado.id]);
  });

  it('sin_movimiento respeta el parámetro del sistema', () => {
    const prod = crearActivo(db, 'Quieto');
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 5 });
    const hace50 = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);
    db.update(schema.existencias).set({ ultima_fecha_movimiento: hace50 }).where(eq(schema.existencias.producto_id, prod.id)).run();
    // umbral default=90: hace50 NO supera → no aparece
    let result = dashboardStockHandler(db);
    expect(result.sin_movimiento.map(s => s.producto_id)).not.toContain(prod.id);
    // umbral=30: hace50 sí supera → aparece
    db.update(schema.parametros_sistema).set({ valor: '30' }).where(eq(schema.parametros_sistema.clave, 'dashboard_dias_sin_movimiento')).run();
    result = dashboardStockHandler(db);
    expect(result.sin_movimiento.map(s => s.producto_id)).toContain(prod.id);
  });

  it('sin_movimiento incluye productos con stock > 0 y ultima_fecha_movimiento = null', () => {
    const prod = crearActivo(db, 'Nunca movido');
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 5 });
    // Forzar ultima_fecha_movimiento = null para simular producto con stock pero sin fecha de movimiento registrada
    db.update(schema.existencias).set({ ultima_fecha_movimiento: null }).where(eq(schema.existencias.producto_id, prod.id)).run();
    const result = dashboardStockHandler(db);
    expect(result.sin_movimiento.map(s => s.producto_id)).toContain(prod.id);
    // No debe estar en sin_stock (tiene stock > 0)
    expect(result.sin_stock.map(s => s.producto_id)).not.toContain(prod.id);
  });
});

describe('dashboardCajaHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin caja abierta → caja_activa null, sin error', () => {
    loginAsAdmin(db);
    const result = dashboardCajaHandler(db);
    expect(result.caja_activa).toBeNull();
    expect(result.ingresos_dia).toBe(0);
    expect(result.egresos_dia).toBe(0);
    expect(result.efectivo_esperado).toBe(0);
  });

  it('ingresos_dia y egresos_dia suman solo movimientos de hoy', () => {
    loginAsAdmin(db);
    const userId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
    const caja = cajaAbrirHandler(db, { monto_inicial: 500 });
    const ahora = new Date();
    db.insert(schema.movimiento_caja).values({
      id: generateId(), caja_id: caja.id, tipo: 'ingreso', motivo: 'venta',
      monto: 300, forma_pago: 'efectivo', referencia_tipo: 'test', referencia_id: 'r1',
      usuario_id: userId, fecha: ahora, version: 1, origin_id: 'test', sync_state: 'pending', updated_at: ahora,
    }).run();
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    db.insert(schema.movimiento_caja).values({
      id: generateId(), caja_id: caja.id, tipo: 'egreso', motivo: 'gasto',
      monto: 100, forma_pago: 'efectivo', referencia_tipo: 'test', referencia_id: 'r2',
      usuario_id: userId, fecha: ayer, version: 1, origin_id: 'test', sync_state: 'pending', updated_at: ahora,
    }).run();
    const result = dashboardCajaHandler(db);
    expect(result.ingresos_dia).toBe(300);
    expect(result.egresos_dia).toBe(0);
  });

  it('arqueos_recientes: últimas 5 cajas cerradas con usuario_nombre', () => {
    loginAsAdmin(db);
    const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
    const ahora = new Date();
    for (let i = 0; i < 6; i++) {
      db.insert(schema.caja).values({
        id: `caja-arch-${i}`, usuario_id: adminId,
        fecha_apertura: new Date(ahora.getTime() - (i + 2) * 60 * 60 * 1000),
        fecha_cierre:   new Date(ahora.getTime() - (i + 1) * 60 * 60 * 1000),
        monto_inicial: 0, diferencia: i * 10, estado: 'cerrada',
        version: 1, origin_id: 'test', sync_state: 'pending', updated_at: ahora,
      }).run();
    }
    const result = dashboardCajaHandler(db);
    expect(result.arqueos_recientes).toHaveLength(5);
    expect(result.arqueos_recientes[0].usuario_nombre).toBeTruthy();
    expect(result.arqueos_recientes[0].diferencia).toBeDefined();
  });
});

describe('Guard: FORBIDDEN sin dashboard.ver', () => {
  beforeEach(() => {
    clearSession();
    setSession(
      { userId: 'u2', rolId: 'op', permisos: new Set([]) },
      { id: 'u2', nombreCompleto: 'Op', rolId: 'op', rolNombre: '', permisos: [], passwordDiasRestantes: 30, preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] } },
    );
  });

  it('dashboard:ventas sin permiso → FORBIDDEN', async () => {
    const handler = requirePermission('dashboard.ver')(async () => 'ok');
    await expect(handler(null as any)).rejects.toThrow('FORBIDDEN');
  });

  it('dashboard:stock sin permiso → FORBIDDEN', async () => {
    const handler = requirePermission('dashboard.ver')(async () => 'ok');
    await expect(handler(null as any)).rejects.toThrow('FORBIDDEN');
  });

  it('dashboard:caja sin permiso → FORBIDDEN', async () => {
    const handler = requirePermission('dashboard.ver')(async () => 'ok');
    await expect(handler(null as any)).rejects.toThrow('FORBIDDEN');
  });
});
