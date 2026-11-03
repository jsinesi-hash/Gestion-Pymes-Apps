import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler, cajaCerrarHandler } from '@core/main';
import { ventaConfirmarHandler, ventaListByCajaHandler, type VentaConfirmarPayload } from '../venta';
import { redondearPeso } from '@ferreteria/shared';
import {
  ventaEsperaPausarHandler,
  ventaEsperaListarHandler,
  ventaEsperaRetomarHandler,
  ventaEsperaDescartarHandler,
  type PausarPayload,
} from '../venta-espera';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';

describe('venta-espera handlers', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
  });

  function crearProductoConStock(stock = 10, precio = 1000) {
    loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto)
      .where(eq(schema.impuesto.predeterminado, true)).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo M6',
      categoria_id: cat.id,
      impuesto_id: imp.id,
      unidad_venta: 'u',
      precio_venta_lista: precio,
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: stock });
    return { prod, imp };
  }

  function abrirCaja() {
    loginAsAdmin(db);
    return cajaAbrirHandler(db, { monto_inicial: 0 });
  }

  function makePausarPayload(cajaId: string, prodId: string, cantidad = 2, precio = 1000, alias?: string): PausarPayload {
    const total = precio * cantidad;
    return {
      caja_id: cajaId,
      cliente_id: CF_ID,
      lineas: [{
        producto_id: prodId,
        descripcion: 'Tornillo M6',
        cantidad,
        precio_unitario: precio,
        descuento_linea: 0,
        alicuota_iva: 21,
        subtotal: total,
      }],
      descuento_global: 0,
      subtotal: total,
      importe_iva: Math.round(total * 21 / 121 * 100) / 100,
      total,
      ajuste_redondeo: 0,
      alias,
    };
  }

  function makeConfirmarPayload(cajaId: string, prodId: string, cantidad = 2, precio = 1000): VentaConfirmarPayload {
    const total = precio * cantidad;
    return {
      caja_id: cajaId,
      cliente_id: CF_ID,
      lineas: [{
        producto_id: prodId,
        descripcion: 'Tornillo M6',
        cantidad,
        precio_unitario: precio,
        descuento_linea: 0,
        alicuota_iva: 21,
        subtotal: total,
      }],
      descuento_global: 0,
      subtotal: total,
      importe_iva: Math.round(total * 21 / 121 * 100) / 100,
      total,
      ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: Math.round(total * 100) }],
    };
  }

  // ── pausar ────────────────────────────────────────────────────────────────

  it('pausar y retomar → líneas correctas, sin tocar caja/stock', () => {
    const { prod } = crearProductoConStock(10);
    const caja = abrirCaja();

    const stockAntes = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(stockAntes.stock_fisico).toBe(10);

    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));

    // Stock no cambia
    const stockDespues = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(stockDespues.stock_fisico).toBe(10);

    // No movimiento de caja
    const movs = db.select().from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.caja_id, caja.id)).all();
    expect(movs).toHaveLength(0);

    // Venta en en_espera con número placeholder
    const ventaRow = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
    expect(ventaRow.estado).toBe('en_espera');
    expect(ventaRow.numero_interno).toMatch(/^HOLD:/);

    // Retomar devuelve líneas correctas
    const result = ventaEsperaRetomarHandler(db, { venta_id });
    expect(result.lineas).toHaveLength(1);
    expect(result.lineas[0].producto_id).toBe(prod.id);
    expect(result.lineas[0].cantidad).toBe(2);
    expect(result.avisos.stock_caido).toHaveLength(0);
    expect(result.avisos.precio_cambiado).toHaveLength(0);
  });

  it('pausar varias, retomar la correcta por id', () => {
    const { prod } = crearProductoConStock(20);
    const caja = abrirCaja();

    const { venta_id: id1 } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id, 1, 1000, 'Cliente A'));
    const { venta_id: id2 } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id, 3, 1000, 'Cliente B'));

    const result = ventaEsperaRetomarHandler(db, { venta_id: id2 });
    expect(result.venta_id).toBe(id2);
    expect(result.alias).toBe('Cliente B');
    expect(result.lineas[0].cantidad).toBe(3);

    const result1 = ventaEsperaRetomarHandler(db, { venta_id: id1 });
    expect(result1.lineas[0].cantidad).toBe(1);
  });

  it('descartar → estado descartada, no impacta caja/stock/listByCaja', () => {
    const { prod } = crearProductoConStock(10);
    const caja = abrirCaja();

    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));
    ventaEsperaDescartarHandler(db, { venta_id });

    const ventaRow = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
    expect(ventaRow.estado).toBe('descartada');

    // Stock intacto
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(ex.stock_fisico).toBe(10);

    // No aparece en listByCaja
    const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
    expect(ventas).toHaveLength(0);
  });

  it('MAX_EN_ESPERA bloquea cuando se supera el parámetro', () => {
    db.update(schema.parametros_sistema)
      .set({ valor: '2' })
      .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.max'))
      .run();

    const { prod } = crearProductoConStock(30);
    const caja = abrirCaja();

    ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));
    ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));

    expect(() => ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id)))
      .toThrow('MAX_EN_ESPERA');
  });

  it('retomar con stock caído → avisa sin bloquear, líneas devueltas', () => {
    const { prod } = crearProductoConStock(5);
    const caja = abrirCaja();

    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id, 5));

    // Drenar stock
    db.update(schema.existencias)
      .set({ stock_fisico: 2 })
      .where(eq(schema.existencias.producto_id, prod.id))
      .run();

    const result = ventaEsperaRetomarHandler(db, { venta_id });
    expect(result.avisos.stock_caido).toHaveLength(1);
    expect(result.avisos.stock_caido[0].producto_id).toBe(prod.id);
    expect(result.avisos.stock_caido[0].stock_disponible).toBe(2);
    expect(result.lineas).toHaveLength(1); // no bloquea
  });

  it('retomar con precio cambiado → reprecia y avisa', () => {
    const { prod } = crearProductoConStock(10, 1000);
    const caja = abrirCaja();

    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id, 1, 1000));

    // Cambiar precio lista
    db.update(schema.producto)
      .set({ precio_venta_lista: 1500 })
      .where(eq(schema.producto.id, prod.id))
      .run();

    const result = ventaEsperaRetomarHandler(db, { venta_id });
    expect(result.avisos.precio_cambiado).toHaveLength(1);
    expect(result.avisos.precio_cambiado[0].precio_nuevo).toBe(1500);
    expect(result.lineas[0].precio_lista_actual_centavos).toBe(150000);
  });

  it('en_espera NO aparece en ventaListByCajaHandler (audit fix)', () => {
    const { prod } = crearProductoConStock(10);
    const caja = abrirCaja();

    ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));

    const ventas = ventaListByCajaHandler(db, { caja_id: caja.id });
    expect(ventas.every(v => v.estado === 'confirmada' || v.estado === 'anulada')).toBe(true);
    expect(ventas).toHaveLength(0);
  });

  it('confirmar post-retomar asigna caja activa al confirmar', () => {
    const { prod } = crearProductoConStock(10);
    loginAsAdmin(db);
    const caja1 = cajaAbrirHandler(db, { monto_inicial: 0 });
    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja1.id, prod.id));

    cajaCerrarHandler(db, { caja_id: caja1.id, monto_contado: 0 });
    const caja2 = cajaAbrirHandler(db, { monto_inicial: 0 });

    ventaEsperaRetomarHandler(db, { venta_id });

    const result = ventaConfirmarHandler(db, {
      ...makeConfirmarPayload(caja2.id, prod.id),
      venta_en_espera_id: venta_id,
    });

    expect(result.venta.caja_id).toBe(caja2.id);
    expect(result.venta.numero_interno).toMatch(/^V-C1-\d{6}$/);
    expect(result.venta.estado).toBe('confirmada');
    // retomar REEMPLAZA las líneas de la espera (no las duplica)
    expect(result.detalles).toHaveLength(1);

    // Stock descontado
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, prod.id)).get()!;
    expect(ex.stock_fisico).toBe(8); // 10 - 2
  });

  it('confirmar post-retomar sin caja abierta → CAJA_REQUERIDA', () => {
    const { prod } = crearProductoConStock(10);
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));
    cajaCerrarHandler(db, { caja_id: caja.id, monto_contado: 0 });

    expect(() => ventaConfirmarHandler(db, {
      ...makeConfirmarPayload('caja-inexistente', prod.id),
      venta_en_espera_id: venta_id,
    })).toThrow('CAJA_REQUERIDA');
  });

  it('TTL: marca vencida sin auto-descartar', () => {
    db.update(schema.parametros_sistema)
      .set({ valor: '1' })
      .where(eq(schema.parametros_sistema.clave, 'pos.ventas_en_espera.ttl_horas'))
      .run();

    const { prod } = crearProductoConStock(10);
    const caja = abrirCaja();
    const { venta_id } = ventaEsperaPausarHandler(db, makePausarPayload(caja.id, prod.id));

    // Retroceder fecha 2 horas
    db.update(schema.venta)
      .set({ en_espera_desde: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(schema.venta.id, venta_id))
      .run();

    const lista = ventaEsperaListarHandler(db);
    const item = lista.find(v => v.id === venta_id)!;
    expect(item.vencida).toBe(true);

    // Sigue en en_espera (no auto-descarta)
    const ventaRow = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
    expect(ventaRow.estado).toBe('en_espera');
  });


  // ── pausar: los totales se verifican en el main, igual que al confirmar ─────────────────────────
  // Revisión 2026-10-20 (P1): `confirmarVenta` rehace la cuenta en centavos, pero pausar guardaba
  // subtotal, IVA, total y ajuste tal como llegaban del renderer (límite declarado en el ADR de
  // totales). Una venta en espera con totales inconsistentes se listaba con un total falso.
  describe('pausar verifica los totales como la confirmación', () => {
    const contarVentas = () => db.select().from(schema.venta).all().length;
    const contarDetalles = () => db.select().from(schema.venta_detalle).all().length;

    function preparar() {
      const { prod } = crearProductoConStock(10);
      const caja = abrirCaja();
      return { prod, caja };
    }

    function rechaza(mutar: (p: PausarPayload) => void, codigo: string) {
      const { prod, caja } = preparar();
      const p = makePausarPayload(caja.id, prod.id, 2, 1000);
      mutar(p);
      expect(() => ventaEsperaPausarHandler(db, p)).toThrow(codigo);
      // No queda nada a medias: ni la cabecera ni las líneas.
      expect(contarVentas()).toBe(0);
      expect(contarDetalles()).toBe(0);
    }

    it('rechaza un total que no coincide con las líneas', () => {
      rechaza((p) => { p.total = 1; }, 'TOTALES_INCONSISTENTES');
    });

    it('rechaza un subtotal general inconsistente', () => {
      rechaza((p) => { p.subtotal = 1999; }, 'TOTALES_INCONSISTENTES');
    });

    it('rechaza el subtotal de una línea que no es precio × cantidad', () => {
      rechaza((p) => { p.lineas[0]!.subtotal = 1; }, 'TOTALES_INCONSISTENTES');
    });

    it('rechaza un IVA inconsistente', () => {
      rechaza((p) => { p.importe_iva = 0; }, 'TOTALES_INCONSISTENTES');
    });

    it('rechaza un ajuste de redondeo que no corresponde', () => {
      rechaza((p) => { p.ajuste_redondeo = 0.5; }, 'TOTALES_INCONSISTENTES');
    });

    it('rechaza un descuento global fuera de rango', () => {
      rechaza((p) => { p.descuento_global = 150; }, 'DESCUENTO_INVALIDO');
    });

    it('rechaza una línea con cantidad cero', () => {
      rechaza((p) => { p.lineas[0]!.cantidad = 0; }, 'CANTIDAD_INVALIDA');
    });

    it('rechaza un precio unitario negativo', () => {
      rechaza((p) => { p.lineas[0]!.precio_unitario = -5; }, 'PRECIO_INVALIDO');
    });

    it('acepta un carrito con descuento global y redondeo calculados como el POS', () => {
      const { prod, caja } = preparar();
      const p = makePausarPayload(caja.id, prod.id, 3, 333.33);
      p.descuento_global = 10;
      const conDescuento = Math.round(Math.round(333.33 * 100) * 3 * (1 - 10 / 100));
      const red = redondearPeso(conDescuento);
      p.total = red.totalCentavos / 100;
      p.ajuste_redondeo = red.ajusteRedondeoCentavos / 100;
      p.subtotal = Math.round(333.33 * 100) * 3 / 100;
      p.lineas[0]!.subtotal = p.subtotal;
      p.importe_iva = Math.round(p.subtotal * 21 / 121 * 100) / 100;
      const r = ventaEsperaPausarHandler(db, p);
      expect(r.venta_id).toBeTruthy();
      expect(contarVentas()).toBe(1);
    });

    it('acepta el IVA sin redondear a centavos (el renderer lo calcula en float)', () => {
      const { prod, caja } = preparar();
      const p = makePausarPayload(caja.id, prod.id, 2, 1000);
      p.importe_iva = (2 * 1000 * 21) / 121; // float sin redondear, como lo manda el renderer
      expect(() => ventaEsperaPausarHandler(db, p)).not.toThrow();
    });

    it('un carrito inconsistente no ocupa un lugar del tope de ventas en espera', () => {
      const { prod, caja } = preparar();
      const mala = makePausarPayload(caja.id, prod.id, 2, 1000);
      mala.total = 1;
      expect(() => ventaEsperaPausarHandler(db, mala)).toThrow('TOTALES_INCONSISTENTES');
      const buena = makePausarPayload(caja.id, prod.id, 2, 1000);
      expect(() => ventaEsperaPausarHandler(db, buena)).not.toThrow();
      expect(ventaEsperaListarHandler(db)).toHaveLength(1);
    });
  });
});
