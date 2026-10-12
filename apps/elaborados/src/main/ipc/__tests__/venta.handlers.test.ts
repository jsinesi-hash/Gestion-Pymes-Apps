import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { runCatalogSeedElaborados, CONSUMIDOR_FINAL_ID } from '../../catalog/seed';
import { cajaAbrirHandler } from '@core/main';
import { articuloCreateHandler } from '../articulo';
import { categoriaVentaCreateHandler } from '../categoria-venta';
import { grupoModificadorCreateHandler, grupoModificadorOpcionSetHandler } from '../grupo-modificador';
import { productoVentaCreateHandler } from '../producto-venta';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { ventaCotizarHandler, ventaConfirmarHandler } from '../venta';

type Db = ReturnType<typeof setupDb>;

/** Heladería mínima: pote 1/4 (envase fijo + 1..3 sabores en reparto), palito de reventa que bloquea. */
function catalogo(db: Db) {
  runCatalogSeedElaborados(db);
  const impuesto = db.select().from(schema.impuesto).all()[0];
  const cat = categoriaVentaCreateHandler(db, { nombre: 'Helados', orden: 1 });
  const envase = articuloCreateHandler(db, { nombre: 'Envase 1/4', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const palitoArt = articuloCreateHandler(db, { nombre: 'Palito', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: true });
  const choco = articuloCreateHandler(db, { nombre: 'Chocolate', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  const ddl = articuloCreateHandler(db, { nombre: 'Dulce de leche', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: false });
  const grupo = grupoModificadorCreateHandler(db, { nombre: 'Sabores' });
  grupoModificadorOpcionSetHandler(db, {
    grupo_modificador_id: grupo.id,
    opciones: [
      { articulo_id: choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 },
      { articulo_id: ddl.id, nombre: 'Dulce de leche', recargo_centavos: 20000, cantidad: 0, orden: 2 },
    ],
  });
  const opciones = db.select().from(schema.grupo_modificador_opcion).all();
  const opChoco = opciones.find((o) => o.articulo_id === choco.id)!;
  const opDdl = opciones.find((o) => o.articulo_id === ddl.id)!;
  const pote = productoVentaCreateHandler(db, {
    nombre: 'Pote 1/4', categoria_venta_id: cat.id, precio_centavos: 150000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: envase.id, cantidad: 1 }],
    grupos: [{ grupo_modificador_id: grupo.id, min: 1, max: 3, cantidad_total: 0.25, modo_descuento: 'reparto', orden: 1 }],
  });
  const palito = productoVentaCreateHandler(db, {
    nombre: 'Palito', categoria_venta_id: cat.id, precio_centavos: 100000, impuesto_id: impuesto.id,
    componentes: [{ articulo_id: palitoArt.id, cantidad: 1 }], grupos: [],
  });
  const stock = (articulo_id: string, cantidad: number) =>
    movimientoArticuloCreateHandler(db, { articulo_id, motivo: 'compra', cantidad, costo_unitario_centavos: 100 });
  stock(envase.id, 10); stock(palitoArt.id, 2); stock(choco.id, 5); stock(ddl.id, 5);
  return { pote, palito, grupo, opChoco, opDdl, envase, palitoArt, choco, ddl };
}

function stockDe(db: Db, articulo_id: string) {
  return db.select().from(schema.existencia_articulo)
    .where(eq(schema.existencia_articulo.articulo_id, articulo_id)).get()!.stock;
}

describe('venta handlers (Elaborados)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  describe('ventaCotizarHandler', () => {
    it('valoriza el carrito desde el catálogo sin persistir nada', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const r = ventaCotizarHandler(db, {
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 1,
          modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id, c.opDdl.id] }] }],
      });
      expect(r.lineas[0].precio_unitario_centavos).toBe(170000);
      expect(r.total_centavos).toBe(170000);
      expect(r.bloqueos).toEqual([]);
      expect(r.advertencias).toEqual([]);
      expect(db.select().from(schema.venta).all()).toHaveLength(0);
    });

    it('informa bloqueos (reventa sin stock) y advertencias (granel que quedaría en negativo)', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const r = ventaCotizarHandler(db, {
        lineas: [
          { producto_venta_id: c.palito.id, cantidad: 3 }, // stock 2, bloquea
          { producto_venta_id: c.pote.id, cantidad: 1, // 0.25 kg repartido: queda dentro del stock
            modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id] }] },
        ],
      });
      expect(r.bloqueos.map((b) => b.nombre)).toEqual(['Palito']);
      const grande = ventaCotizarHandler(db, {
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 30,
          modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id] }] }],
      });
      expect(grande.advertencias.map((a) => a.nombre)).toContain('Chocolate'); // 30 × 0.25 = 7.5 > 5, no bloquea
    });

    it('rechaza sin sesión y payload mal formado', () => {
      expect(() => ventaCotizarHandler(db, { lineas: [] })).toThrow('UNAUTHENTICATED');
      loginAsAdmin(db);
      expect(() => ventaCotizarHandler(db, { lineas: 'x' })).toThrow();
      expect(() => ventaCotizarHandler(db, { lineas: [] })).toThrow('CARRITO_VACIO');
    });
  });

  describe('ventaConfirmarHandler', () => {
    function preparar() {
      loginAsAdmin(db);
      const c = catalogo(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
      return { c, caja };
    }
    const pote = (c: ReturnType<typeof catalogo>, opcionIds: string[], cantidad = 1) => ({
      producto_venta_id: c.pote.id, cantidad,
      modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: opcionIds }],
    });

    it('confirma: persiste venta, líneas con snapshots, modificadores y movimientos de artículo', () => {
      const { c, caja } = preparar();
      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [pote(c, [c.opChoco.id, c.opDdl.id])],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 170000 }],
      });
      expect(r.venta.numero_interno).toBe('V-C1-000001');
      expect(r.venta.total).toBe(1700);
      expect(r.venta.estado).toBe('confirmada');
      expect(r.comprobante.tipo).toBe('ticket_interno');
      expect(r.advertencias).toEqual([]);

      expect(r.lineas).toHaveLength(1);
      expect(r.lineas[0]).toMatchObject({ descripcion: 'Pote 1/4', precio_unitario_centavos: 170000, subtotal_centavos: 170000, alicuota_iva: 21 });
      expect(r.lineas[0].modificadores.map((m) => m.descripcion).sort()).toEqual(['Chocolate', 'Dulce de leche']);
      expect(r.lineas[0].modificadores.find((m) => m.descripcion === 'Dulce de leche')).toMatchObject({ recargo_centavos: 20000 });

      expect(stockDe(db, c.envase.id)).toBe(9);
      expect(stockDe(db, c.choco.id)).toBeCloseTo(5 - 0.125, 6);
      expect(stockDe(db, c.ddl.id)).toBeCloseTo(5 - 0.125, 6);
      const movs = db.select().from(schema.movimiento_articulo)
        .where(eq(schema.movimiento_articulo.referencia_id, r.venta.id)).all();
      expect(movs).toHaveLength(3);
      expect(movs.every((m) => m.tipo === 'salida' && m.motivo === 'venta' && m.cantidad < 0)).toBe(true);
    });

    it('reventa que bloquea sin stock → STOCK_INSUFICIENTE y nada se persiste', () => {
      const { c, caja } = preparar();
      expect(() => ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 3 }],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 300000 }],
      })).toThrow('STOCK_INSUFICIENTE:Palito');
      expect(db.select().from(schema.venta).all()).toHaveLength(0);
      expect(stockDe(db, c.palitoArt.id)).toBe(2);
    });

    it('granel que no bloquea: vende, deja stock negativo y devuelve advertencias', () => {
      const { c, caja } = preparar();
      // El envase bloquea: se repone para que solo el chocolate (granel, no bloquea) quede corto.
      movimientoArticuloCreateHandler(db, { articulo_id: c.envase.id, motivo: 'compra', cantidad: 100, costo_unitario_centavos: 100 });
      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [pote(c, [c.opChoco.id], 30)], // 30 × 0.25 = 7.5 kg de chocolate, hay 5
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 30 * 150000 }],
      });
      expect(stockDe(db, c.choco.id)).toBeCloseTo(-2.5, 6);
      expect(r.advertencias.map((a) => a.nombre)).toContain('Chocolate');
    });

    it('descuentos de línea y global se reflejan en el total cobrado', () => {
      const { c, caja } = preparar();
      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 1, descuento_linea_pct: 10 }],
        descuento_global_pct: 10,
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 81000 }],
      });
      expect(r.venta.total).toBe(810);
      expect(r.venta.descuento_global).toBe(90);
      expect(r.lineas[0].descuento_linea_pct).toBe(10);
    });

    it('pago insuficiente → SALDO_PENDIENTE; sin caja → CAJA_REQUERIDA; sin sesión → UNAUTHENTICATED', () => {
      const { c, caja } = preparar();
      const base = { cliente_id: CONSUMIDOR_FINAL_ID, lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }] };
      expect(() => ventaConfirmarHandler(db, { ...base, caja_id: caja.id, pagos: [{ medio_pago: 'efectivo', monto_centavos: 1 }] }))
        .toThrow('SALDO_PENDIENTE');
      expect(() => ventaConfirmarHandler(db, { ...base, caja_id: 'no-existe', pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }] }))
        .toThrow('CAJA_REQUERIDA');
      clearSession();
      expect(() => ventaConfirmarHandler(db, { ...base, caja_id: caja.id, pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }] }))
        .toThrow('UNAUTHENTICATED');
    });

    it('valida el carrito contra el catálogo (MODIFICADOR_MIN) sin tocar el stock', () => {
      const { c, caja } = preparar();
      expect(() => ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 1 }], // exige ≥1 sabor
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 150000 }],
      })).toThrow('MODIFICADOR_MIN');
      expect(stockDe(db, c.envase.id)).toBe(10);
    });
  });
});
