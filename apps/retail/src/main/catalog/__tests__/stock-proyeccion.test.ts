import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import { cajaAbrirHandler, clienteUpsertHandler, ctacteSetLimiteHandler, diferenciasDeCuentaCorriente } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../ipc/__tests__/helpers';
import { runCatalogSeed } from '../seed';
import { categoriaCreateHandler } from '../../ipc/categoria';
import { productoCreateHandler } from '../../ipc/producto';
import { stockEntradaHandler, stockMermaHandler, stockAjusteHandler } from '../../ipc/stock';
import { ventaConfirmarHandler, ventaAnularHandler } from '../../ipc/venta';
import { diferenciasDeStock, proyectarStock, recalcularStock } from '../stock-proyeccion';
import { runDemoCatalogSeed } from '../../base-seed/demo-catalog';
import { seedCatalog } from '../../dev-seed/catalog';
import { seedVentas } from '../../dev-seed/ventas';
import { seedPersonas } from '../../dev-seed/personas';

// ADR-151: el stock es una proyección del libro desde el último conteo.
const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

describe('proyección del stock (Retail)', () => {
  let db: ReturnType<typeof setupDb>;
  const stock = (id: string) => db.select().from(schema.existencias)
    .where(eq(schema.existencias.producto_id, id)).get()!;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  function producto(nombre = 'Tornillo M6') {
    const cat = categoriaCreateHandler(db, { nombre: `Cat ${nombre}` });
    const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
    return productoCreateHandler(db, {
      nombre_corto: nombre, categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 1000,
    });
  }

  function vender(cajaId: string, productoId: string, cantidad: number) {
    const total = 1000 * cantidad;
    return ventaConfirmarHandler(db, {
      caja_id: cajaId, cliente_id: CF_ID,
      lineas: [{ producto_id: productoId, descripcion: 'x', cantidad, precio_unitario_centavos: 100000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: total * 100 }],
      descuento_global: 0, subtotal_centavos: total * 100, importe_iva_centavos: Math.round(total * 100 * 21 / 121), total_centavos: total * 100, ajuste_redondeo_centavos: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: total * 100 }],
    });
  }

  /** Un movimiento que llega de otra terminal con su propia fecha (no pasa por los handlers locales). */
  function movimientoDeOtraTerminal(productoId: string, fecha: Date, tipo: 'salida' | 'entrada', cantidad: number) {
    db.insert(schema.movimiento_stock).values({
      id: generateId(), producto_id: productoId, tipo, motivo: tipo === 'salida' ? 'venta' : 'entrada_manual',
      cantidad, stock_resultante: 0, costo_unitario: null, referencia_tipo: 'venta', referencia_id: generateId(),
      usuario_id: db.select().from(schema.usuario).get()!.id, fecha, observaciones: null,
      version: 1, origin_id: 'C2', sync_state: 'synced', updated_at: fecha,
    }).run();
  }

  it('después de entradas, ventas, mermas, conteos y anulaciones, lo guardado coincide con la proyección', () => {
    const a = producto('A');
    const b = producto('B');
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10, costo_unitario: 100 });
    stockEntradaHandler(db, { producto_id: b.id, cantidad: 5 });
    vender(caja.id, a.id, 3);
    stockMermaHandler(db, { producto_id: a.id, cantidad: 1, observaciones: 'rota' });
    stockAjusteHandler(db, { producto_id: b.id, cantidad_contada: 4, observaciones: 'conteo' });
    const v = vender(caja.id, b.id, 2);
    ventaAnularHandler(db, { venta_id: v.venta.id, motivo: 'x', supervisor_credenciales: SUP });

    expect(stock(a.id).stock_fisico).toBe(6);
    expect(stock(b.id).stock_fisico).toBe(4);
    expect(proyectarStock(db, a.id)).toBe(6);
    expect(proyectarStock(db, b.id)).toBe(4);
    expect(diferenciasDeStock(db)).toEqual([]);
  });

  it('el conteo es un punto de corte: lo anterior que llega tarde no cambia el stock, lo posterior sí', () => {
    const a = producto();
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10 });
    stockAjusteHandler(db, { producto_id: a.id, cantidad_contada: 8, observaciones: 'conteo' });
    const conteo = db.select().from(schema.movimiento_stock)
      .where(eq(schema.movimiento_stock.motivo, 'ajuste_conteo')).get()!;

    // La caja 2 vendió 2 antes del conteo, sin conexión: el conteo ya las descontó físicamente.
    movimientoDeOtraTerminal(a.id, new Date(conteo.fecha.getTime() - 60_000), 'salida', 2);
    expect(proyectarStock(db, a.id)).toBe(8);

    // Una venta posterior al conteo sí descuenta.
    movimientoDeOtraTerminal(a.id, new Date(conteo.fecha.getTime() + 60_000), 'salida', 3);
    expect(proyectarStock(db, a.id)).toBe(5);
  });

  it('sin conteos proyecta desde cero; un producto sin movimientos da 0', () => {
    const a = producto('A');
    const b = producto('B');
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 7 });
    expect(proyectarStock(db, a.id)).toBe(7);
    expect(proyectarStock(db, b.id)).toBe(0);
  });

  it('el catálogo demo y el seed de desarrollo cuadran con su libro', () => {
    runDemoCatalogSeed(db);
    expect(diferenciasDeStock(db)).toEqual([]);
    const otra = setupDb();
    runCatalogSeed(otra);
    seedCatalog(otra, false);
    seedPersonas(otra, false);
    seedVentas(otra, false);
    expect(diferenciasDeStock(otra)).toEqual([]);
  });

  it('la cuenta corriente cuadra después de una venta a crédito y su anulación', () => {
    const a = producto();
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10 });
    const caja = cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
    const cliente = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111222', nombre: 'Ana', apellido: 'Gómez',
      condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
    });
    const cuenta = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, cliente.id)).get()!;
    ctacteSetLimiteHandler(db, { cuentaId: cuenta.id, limite_centavos: 1_000_000 });
    const total = 2000;
    const v = ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: cliente.id,
      lineas: [{ producto_id: a.id, descripcion: 'x', cantidad: 2, precio_unitario_centavos: 100000, descuento_linea: 0, alicuota_iva: 21, subtotal_centavos: total * 100 }],
      descuento_global: 0, subtotal_centavos: total * 100, importe_iva_centavos: Math.round(total * 100 * 21 / 121), total_centavos: total * 100, ajuste_redondeo_centavos: 0,
      pagos: [{ medio_pago: 'cuenta_corriente', monto_centavos: total * 100 }],
    });
    expect(diferenciasDeCuentaCorriente(db)).toEqual([]);
    ventaAnularHandler(db, { venta_id: v.venta.id, motivo: 'x', supervisor_credenciales: SUP });
    expect(diferenciasDeCuentaCorriente(db)).toEqual([]);
    expect(diferenciasDeStock(db)).toEqual([]);
  });

  it('recalcularStock corrige un saldo desfasado y lo informa; si cuadra no toca la fila', () => {
    const a = producto();
    stockEntradaHandler(db, { producto_id: a.id, cantidad: 10 });
    const antes = stock(a.id);
    expect(recalcularStock(db, a.id)).toEqual({ guardado: 10, proyectado: 10, corregido: false });
    expect(stock(a.id).version).toBe(antes.version);

    db.update(schema.existencias).set({ stock_fisico: 99 }).where(eq(schema.existencias.producto_id, a.id)).run();
    expect(diferenciasDeStock(db)).toEqual([{ producto_id: a.id, guardado: 99, proyectado: 10 }]);
    expect(recalcularStock(db, a.id)).toEqual({ guardado: 99, proyectado: 10, corregido: true });
    expect(stock(a.id).stock_fisico).toBe(10);
    expect(diferenciasDeStock(db)).toEqual([]);
  });
});
