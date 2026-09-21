import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { listaPrecioCreateHandler } from '../lista-precio';
import {
  presentacionListByProductoHandler,
  presentacionCreateHandler,
  presentacionUpdateHandler,
  presentacionSetDefaultHandler,
  presentacionDesactivarHandler,
  presentacionBuscarPorGtinHandler,
  presentacionEliminarHandler,
  presentacionReactivarHandler,
} from '../presentacion';
import { ventaConfirmarHandler } from '../venta';
import { cajaAbrirHandler } from '../caja';

function setupProducto(db: ReturnType<typeof setupDb>, unidadVenta = 'u') {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, {
    nombre_corto: 'Prod test',
    categoria_id: cat.id,
    impuesto_id: imp.id,
    unidad_venta: unidadVenta,
    precio_venta_lista: 100,
  });
}

function setupListaPrecio(db: ReturnType<typeof setupDb>) {
  return listaPrecioCreateHandler(db, {
    nombre: 'Lista General',
    tipo: 'general',
    ajuste_porcentual: 0,
    predeterminada: true,
  });
}

function unidadId(db: ReturnType<typeof setupDb>, abrev: string): string {
  return db.select().from(schema.unidad)
    .where(eq(schema.unidad.abreviatura, abrev)).get()!.id;
}

describe('presentacion handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => { db = setupDb(); clearSession(); });

  // ── crearPresentacionDefault vía productoCreateHandler ───────────────────────

  it('productoCreateHandler crea presentación default automáticamente', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const pps = presentacionListByProductoHandler(db, { producto_id: prod.id });
    expect(pps).toHaveLength(1);
    expect(pps[0].es_default).toBe(true);
    expect(pps[0].factor_a_stock).toBe(1.0);
    expect(pps[0].activo).toBe(true);
  });

  it('productoCreateHandler asigna presentacion_id en lista_precio_valor', () => {
    loginAsAdmin(db);
    setupListaPrecio(db);
    const prod = setupProducto(db);
    const [pp] = presentacionListByProductoHandler(db, { producto_id: prod.id });
    const lpv = db.select().from(schema.lista_precio_valor)
      .where(and(
        eq(schema.lista_precio_valor.producto_id, prod.id),
        eq(schema.lista_precio_valor.presentacion_id, pp.id),
      ))
      .all();
    expect(lpv.length).toBeGreaterThan(0);
  });

  // ── NO_DESACTIVAR_DEFAULT ────────────────────────────────────────────────────

  it('presentacionDesactivarHandler bloquea la presentación default', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const [pp] = presentacionListByProductoHandler(db, { producto_id: prod.id });
    expect(() => presentacionDesactivarHandler(db, { id: pp.id }))
      .toThrow('NO_DESACTIVAR_DEFAULT');
  });

  // ── CRUD presentaciones adicionales ─────────────────────────────────────────

  it('presentacionCreateHandler crea presentación no-default', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 12.0,
      gtin_barcode: '7790001112222',
    });
    expect(pp.es_default).toBe(false);
    expect(pp.factor_a_stock).toBe(12.0);
    expect(pp.gtin_barcode).toBe('7790001112222');
  });

  it('presentacionUpdateHandler actualiza factor_a_stock', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 6.0,
    });
    const updated = presentacionUpdateHandler(db, { id: pp.id, factor_a_stock: 10.0 });
    expect(updated.factor_a_stock).toBe(10.0);
    expect(updated.version).toBe(2);
  });

  it('presentacionDesactivarHandler desactiva presentación no-default', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 5.0,
    });
    presentacionDesactivarHandler(db, { id: pp.id });
    const row = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, pp.id)).get()!;
    expect(row.activo).toBe(false);
  });

  // ── setDefault ───────────────────────────────────────────────────────────────

  it('presentacionSetDefaultHandler transfiere el flag default a otra presentación', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const [original] = presentacionListByProductoHandler(db, { producto_id: prod.id });
    expect(original.es_default).toBe(true);

    const nueva = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 10.0,
    });
    presentacionSetDefaultHandler(db, { id: nueva.id });

    const pps = presentacionListByProductoHandler(db, { producto_id: prod.id });
    const nuevoDefault = pps.find(p => p.id === nueva.id)!;
    const anterior = pps.find(p => p.id === original.id)!;
    expect(nuevoDefault.es_default).toBe(true);
    expect(anterior.es_default).toBe(false);
  });

  it('presentacionSetDefaultHandler permite desactivar la presentación que fue default', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const [original] = presentacionListByProductoHandler(db, { producto_id: prod.id });

    const nueva = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 10.0,
    });
    presentacionSetDefaultHandler(db, { id: nueva.id });
    // original ya no es default → se puede desactivar
    expect(() => presentacionDesactivarHandler(db, { id: original.id })).not.toThrow();
    const row = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, original.id)).get()!;
    expect(row.activo).toBe(false);
  });

  it('presentacionSetDefaultHandler lanza NOT_FOUND si el id no existe', () => {
    loginAsAdmin(db);
    expect(() => presentacionSetDefaultHandler(db, { id: 'inexistente' }))
      .toThrow('NOT_FOUND');
  });

  it('presentacionSetDefaultHandler lanza INACTIVO si la presentación está desactivada', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;

    const [defaultPp] = presentacionListByProductoHandler(db, { producto_id: prod.id });
    const otra = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 5.0,
    });
    presentacionDesactivarHandler(db, { id: otra.id });
    expect(() => presentacionSetDefaultHandler(db, { id: otra.id }))
      .toThrow('INACTIVO');
  });

  // ── buscarPorGtin ────────────────────────────────────────────────────────────

  it('buscarPorGtin halla presentación por su propio gtin_barcode', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const pp = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 12.0,
      gtin_barcode: '7790001112222',
    });
    const found = presentacionBuscarPorGtinHandler(db, { gtin: '7790001112222' });
    expect(found?.presentacion_id).toBe(pp.id);
    expect(found?.factor_a_stock).toBe(12.0);
  });

  it('buscarPorGtin cae a la default si el GTIN está en producto', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Cat2' });
    const imp = db.select().from(schema.impuesto).all()[0];
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Prod GTIN',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: 200,
      gtin_barcode: '7790009998888',
    });
    const defaultPp = presentacionListByProductoHandler(db, { producto_id: prod.id })
      .find(p => p.es_default);
    const found = presentacionBuscarPorGtinHandler(db, { gtin: '7790009998888' });
    expect(found?.presentacion_id).toBe(defaultPp?.id);
    expect(found?.es_default).toBe(true);
  });

  it('buscarPorGtin retorna null si no existe', () => {
    loginAsAdmin(db);
    const found = presentacionBuscarPorGtinHandler(db, { gtin: '9999999999999' });
    expect(found).toBeNull();
  });

  // ── descuento de stock usa factor_a_stock_aplicado ───────────────────────────

  it('ventaConfirmar descuenta stock * factor', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'CatV' });
    const imp = db.select().from(schema.impuesto).all()[0];
    const prod = productoCreateHandler(db, {
      nombre_corto: 'ProdVenta', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 1000,
    });

    // Dar stock inicial de 24 unidades
    db.update(schema.existencias)
      .set({ stock_fisico: 24 })
      .where(eq(schema.existencias.producto_id, prod.id))
      .run();

    const defaultPp = presentacionListByProductoHandler(db, { producto_id: prod.id })
      .find(p => p.es_default)!;

    // Crear unidad y presentacion de 12 unidades
    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const ppCaja = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 12.0,
    });

    // Abrir caja
    const adminUser = db.select().from(schema.usuario).get()!;
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });

    // Vender 2 "cajas" con factor 12 → debe descontar 24 unidades de stock
    ventaConfirmarHandler(db, {
      caja_id: caja.id,
      cliente_id: db.select().from(schema.cliente).get()!.id,
      lineas: [{
        producto_id: prod.id,
        descripcion: 'ProdVenta',
        cantidad: 2,
        precio_unitario: 1000,
        descuento_linea: 0,
        alicuota_iva: 0.21,
        subtotal: 2000,
        presentacion_id: ppCaja.id,
        factor_a_stock_aplicado: 12.0,
      }],
      descuento_global: 0,
      subtotal: 2000,
      importe_iva: 347.11,
      total: 2000,
      ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 200000 }],
    });

    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(ex.stock_fisico).toBe(0);

    // Verificar que venta_detalle guardó el snapshot
    const detalles = db.select().from(schema.venta_detalle)
      .where(eq(schema.venta_detalle.producto_id, prod.id)).all();
    expect(detalles[0].presentacion_id).toBe(ppCaja.id);
    expect(detalles[0].factor_a_stock_aplicado).toBe(12.0);
    expect(detalles[0].cantidad).toBe(2); // cantidad en presentación, no en stock
  });

  it('ventaConfirmar falla STOCK_INSUFICIENTE si cantidad*factor > stock', () => {
    loginAsAdmin(db);
    runCatalogSeed(db);
    const cat = categoriaCreateHandler(db, { nombre: 'CatV2' });
    const imp = db.select().from(schema.impuesto).all()[0];
    const prod = productoCreateHandler(db, {
      nombre_corto: 'ProdV2', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 500,
    });

    db.update(schema.existencias)
      .set({ stock_fisico: 11 })
      .where(eq(schema.existencias.producto_id, prod.id))
      .run();

    const unidad = db.select().from(schema.unidad)
      .where(eq(schema.unidad.abreviatura, 'u')).get()!;
    const ppCaja = presentacionCreateHandler(db, {
      producto_id: prod.id,
      unidad_id: unidad.id,
      factor_a_stock: 12.0,
    });

    const adminUser = db.select().from(schema.usuario).get()!;
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });

    // 1 caja × 12 = 12 > 11 de stock → debe fallar
    expect(() => ventaConfirmarHandler(db, {
      caja_id: caja.id,
      cliente_id: db.select().from(schema.cliente).get()!.id,
      lineas: [{
        producto_id: prod.id,
        descripcion: 'ProdV2',
        cantidad: 1,
        precio_unitario: 500,
        descuento_linea: 0,
        alicuota_iva: 0.21,
        subtotal: 500,
        presentacion_id: ppCaja.id,
        factor_a_stock_aplicado: 12.0,
      }],
      descuento_global: 0,
      subtotal: 500,
      importe_iva: 87,
      total: 500,
      ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 50000 }],
    })).toThrow('STOCK_INSUFICIENTE');
  });

  // ── ADR-066: eliminar / reactivar ───────────────────────────────────────────

  it('eliminar físico borra la fila si la presentación nunca se usó', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const nueva = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6,
    });
    presentacionEliminarHandler(db, { id: nueva.id });
    const pps = presentacionListByProductoHandler(db, { producto_id: prod.id });
    expect(pps.find(p => p.id === nueva.id)).toBeUndefined();
  });

  it('eliminar con historial (lista_precio_valor) hace baja lógica, no borra', () => {
    loginAsAdmin(db);
    setupListaPrecio(db);
    const prod = setupProducto(db);
    const nueva = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6,
    });
    const lista = db.select().from(schema.lista_precio).all()[0];
    // fecha_hasta no-null (fila histórica cerrada): el producto ya tiene una fila
    // vigente (fecha_hasta IS NULL) para (lista, producto) creada por setupProducto,
    // y lpv_vigente_unique es un índice único parcial WHERE fecha_hasta IS NULL —
    // dos filas "vigentes" del mismo (lista, producto) violarían ese índice.
    db.insert(schema.lista_precio_valor).values({
      id: 'lpv-hist', lista_precio_id: lista.id, producto_id: prod.id,
      precio_centavos: 1000, fecha_desde: new Date(Date.now() - 172800000),
      fecha_hasta: new Date(Date.now() - 86400000),
      origen: 'manual', presentacion_id: nueva.id, usuario_id: 'u',
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();
    presentacionEliminarHandler(db, { id: nueva.id });
    const row = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, nueva.id)).get();
    expect(row).toBeTruthy();
    expect(row!.activo).toBe(false);
  });

  it('eliminar la default lanza NO_ELIMINAR_DEFAULT', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const [def] = presentacionListByProductoHandler(db, { producto_id: prod.id });
    expect(() => presentacionEliminarHandler(db, { id: def.id })).toThrow('NO_ELIMINAR_DEFAULT');
  });

  it('reactivar vuelve a activar una presentación dada de baja', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const nueva = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6,
    });
    presentacionDesactivarHandler(db, { id: nueva.id });
    presentacionReactivarHandler(db, { id: nueva.id });
    const row = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, nueva.id)).get();
    expect(row!.activo).toBe(true);
  });

  it('reactivar rechaza si colisiona el GTIN con otra presentación activa', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const a = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790001',
    });
    presentacionDesactivarHandler(db, { id: a.id });
    // ADR-068: la baja liberó el GTIN → otra activa puede tomarlo (escenario nativo, ya
    // no hace falta simular un merge de sync con DROP INDEX: el índice ux_pp_gtin es
    // parcial WHERE activo = 1, así que la inactiva 'a' no ocupa el slot).
    presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 12, gtin_barcode: '7790001',
    });
    // Reactivar 'a' volvería a dejar dos activas con el mismo GTIN → se rechaza.
    expect(() => presentacionReactivarHandler(db, { id: a.id })).toThrow('GTIN_DUPLICADO');
  });

  it('reactivar una presentación ya activa con GTIN no lanza (no se cuenta a sí misma)', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const a = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790002',
    });
    // ya está activa; reactivar debe ser no-op, sin throw
    expect(() => presentacionReactivarHandler(db, { id: a.id })).not.toThrow();
    const row = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, a.id)).get();
    expect(row!.activo).toBe(true);
  });

  // ── ADR-068: reuso de GTIN tras baja ─────────────────────────────────────────

  it('ADR-068: dar de baja una presentación libera su GTIN para una nueva', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const a = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790068001',
    });
    presentacionDesactivarHandler(db, { id: a.id });
    // Con el índice condicionado por activo, el GTIN queda libre: crear otra activa funciona.
    const b = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 12, gtin_barcode: '7790068001',
    });
    expect(b.gtin_barcode).toBe('7790068001');
    // La inactiva conserva su GTIN (dato no se pierde).
    const aRow = db.select().from(schema.producto_presentacion)
      .where(eq(schema.producto_presentacion.id, a.id)).get()!;
    expect(aRow.activo).toBe(false);
    expect(aRow.gtin_barcode).toBe('7790068001');
  });

  it('ADR-068: create rechaza GTIN_DUPLICADO si colisiona con otra presentación activa', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790068002',
    });
    expect(() => presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 12, gtin_barcode: '7790068002',
    })).toThrow('GTIN_DUPLICADO');
  });

  it('ADR-068: update rechaza GTIN_DUPLICADO si el GTIN colisiona con otra activa', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790068003',
    });
    const c = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 12, gtin_barcode: '7790068099',
    });
    expect(() => presentacionUpdateHandler(db, { id: c.id, gtin_barcode: '7790068003' }))
      .toThrow('GTIN_DUPLICADO');
  });

  it('ADR-068: update permite tomar un GTIN que sólo tiene una inactiva', () => {
    loginAsAdmin(db);
    const prod = setupProducto(db);
    const a = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 6, gtin_barcode: '7790068004',
    });
    presentacionDesactivarHandler(db, { id: a.id });
    const c = presentacionCreateHandler(db, {
      producto_id: prod.id, unidad_id: unidadId(db, 'u'), factor_a_stock: 12,
    });
    // 'a' está inactiva con ese GTIN → una activa puede tomarlo sin colisión.
    const updated = presentacionUpdateHandler(db, { id: c.id, gtin_barcode: '7790068004' });
    expect(updated.gtin_barcode).toBe('7790068004');
  });
});
