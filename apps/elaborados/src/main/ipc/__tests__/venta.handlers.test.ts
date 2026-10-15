import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID } from '../../catalog/seed';
import { cajaAbrirHandler, pausarVentaEspera } from '@core/main';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { grupoModificadorOpcionSetHandler } from '../grupo-modificador';
import { catalogo, stockDe } from './ventaFixtures';
import {
  ventaCotizarHandler, ventaConfirmarHandler, ventaAnularHandler, ventaGetHandler, ventaCatalogoHandler, registerVentaHandlers,
  parseCarrito, cargarCatalogo, guardarLineasElaborados,
} from '../venta';
import { valorizarCarrito } from '../../domain/venta';

const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

type Db = ReturnType<typeof setupDb>;

/** Cliente + (opcional) cuenta corriente con límite en centavos. */
function crearCliente(db: Db, conCuenta?: { limite: number }) {
  const clienteId = generateId();
  const now = new Date();
  const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
  const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  db.insert(schema.cliente).values({
    id: clienteId, tipo_documento: 'DNI', numero_documento: '11111111',
    nombre: 'Cli', apellido: 'Test', condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: !!conCuenta, activo: true,
    usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
  }).run();
  let cuentaId: string | null = null;
  if (conCuenta) {
    cuentaId = generateId();
    db.insert(schema.cuenta_corriente_cliente).values({
      id: cuentaId, cliente_id: clienteId, saldo_centavos: 0,
      limite_credito_centavos: conCuenta.limite, activo: true, ...sync,
    }).run();
  }
  return { clienteId, cuentaId };
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

    it('rechaza cantidad fuera de rango (Infinity, 1e300) en el borde', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      for (const cantidad of [Infinity, 1e300]) {
        expect(() => ventaCotizarHandler(db, { lineas: [{ producto_venta_id: c.palito.id, cantidad }] })).toThrow(/cantidad:MAX/);
      }
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

    it('editar sabores tras una venta no rompe: la línea histórica conserva su opción y la quitada deja de ofrecerse (ADR-102)', () => {
      const { c, caja } = preparar();
      ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [pote(c, [c.opChoco.id, c.opDdl.id])],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 170000 }],
      });
      grupoModificadorOpcionSetHandler(db, {
        grupo_modificador_id: c.grupo.id,
        opciones: [{ articulo_id: c.choco.id, nombre: 'Chocolate', recargo_centavos: 0, cantidad: 0, orden: 1 }],
      });
      const mods = db.select().from(schema.venta_linea_modificador).all();
      expect(mods.map((m) => m.grupo_modificador_opcion_id).sort()).toEqual([c.opChoco.id, c.opDdl.id].sort());
      const pos = ventaCatalogoHandler(db);
      const grupoPos = pos.productos.find((p) => p.id === c.pote.id)!.grupos[0]!;
      expect(grupoPos.opciones.map((o) => o.id)).toEqual([c.opChoco.id]);
      expect(() => ventaCotizarHandler(db, { lineas: [pote(c, [c.opDdl.id])] })).toThrow('OPCION_INVALIDA');
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
      expect(r.venta.descuento_global).toBe(10); // porcentaje (convención de la columna, igual que Retail)
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

    describe('cuenta corriente', () => {
      const venderEnCtaCte = (c: ReturnType<typeof catalogo>, cajaId: string, clienteId: string, extra: object = {}) =>
        ventaConfirmarHandler(db, {
          caja_id: cajaId, cliente_id: clienteId,
          lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
          pagos: [{ medio_pago: 'cuenta_corriente', monto_centavos: 100000 }], ...extra,
        });

      it('100% a cuenta corriente: sube el saldo, registra cargo y no mueve la caja', () => {
        const { c, caja } = preparar();
        const { clienteId, cuentaId } = crearCliente(db, { limite: 500000 });
        const r = venderEnCtaCte(c, caja.id, clienteId);
        const cuenta = db.select().from(schema.cuenta_corriente_cliente).where(eq(schema.cuenta_corriente_cliente.id, cuentaId!)).get()!;
        expect(cuenta.saldo_centavos).toBe(100000);
        const movs = db.select().from(schema.movimiento_cuenta_corriente)
          .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuentaId!)).all();
        expect(movs).toHaveLength(1);
        expect(movs[0]).toMatchObject({ tipo: 'cargo', monto_centavos: 100000 });
        expect(db.select().from(schema.movimiento_caja).where(eq(schema.movimiento_caja.referencia_id, r.venta.id)).all()).toHaveLength(0);
      });

      it('Consumidor Final (sin cuenta) → CCC_NO_DISPONIBLE', () => {
        const { c, caja } = preparar();
        expect(() => venderEnCtaCte(c, caja.id, CONSUMIDOR_FINAL_ID)).toThrow('CCC_NO_DISPONIBLE');
      });

      it('sobre el límite → LIMITE_CREDITO_EXCEDIDO; con supervisor pasa', () => {
        const { c, caja } = preparar();
        const { clienteId } = crearCliente(db, { limite: 50000 });
        expect(() => venderEnCtaCte(c, caja.id, clienteId)).toThrow('LIMITE_CREDITO_EXCEDIDO');
        expect(db.select().from(schema.venta).all()).toHaveLength(0);
        const r = venderEnCtaCte(c, caja.id, clienteId, { supervisor_credenciales: SUP });
        expect(r.venta.estado).toBe('confirmada');
      });
    });

    it('falla dentro de aplicarLineas → rollback total (nada persistido, correlativo incluido)', () => {
      const { c, caja } = preparar();
      db.delete(schema.existencia_articulo).where(eq(schema.existencia_articulo.articulo_id, c.choco.id)).run();
      expect(() => ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [pote(c, [c.opChoco.id])],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 150000 }],
      })).toThrow();
      expect(db.select().from(schema.venta).all()).toHaveLength(0);
      expect(db.select().from(schema.venta_pago).all()).toHaveLength(0);
      expect(db.select().from(schema.venta_linea).all()).toHaveLength(0);
      expect(db.select().from(schema.venta_linea_modificador).all()).toHaveLength(0);
      expect(db.select().from(schema.movimiento_caja).all().filter((m) => m.motivo === 'venta')).toHaveLength(0);
      expect(db.select().from(schema.movimiento_articulo).all().filter((m) => m.motivo === 'venta')).toHaveLength(0);
      expect(stockDe(db, c.envase.id)).toBe(10);
      expect(db.select().from(schema.parametros_sistema)
        .where(eq(schema.parametros_sistema.clave, 'venta_correlativo_C1')).all()).toHaveLength(0);
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

  describe('confirmar un pedido en espera', () => {
    function preparar() {
      loginAsAdmin(db);
      const c = catalogo(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
      return { c, caja };
    }
    /** Arma un pedido como lo hará venta.espera:pausar: valoriza con el dominio y pausa con el core. */
    function armarPedido(cajaId: string, payload: Record<string, unknown>) {
      const carrito = parseCarrito(payload);
      const { productos, opciones } = cargarCatalogo(db, carrito.lineas.map((l) => l.producto_venta_id));
      const v = valorizarCarrito(productos, opciones, carrito);
      return pausarVentaEspera(db, {
        caja_id: cajaId, cliente_id: CONSUMIDOR_FINAL_ID,
        subtotal: v.subtotal_centavos / 100, descuento_global: carrito.descuento_global_pct,
        importe_iva: v.importe_iva_centavos / 100, total: v.total_centavos / 100,
        ajuste_redondeo: v.ajuste_redondeo_centavos / 100, alias: 'Juan',
      }, { aplicarLineas: (tx, ctx) => guardarLineasElaborados(tx as never, v, ctx) }).venta_id;
    }
    const potes = (c: ReturnType<typeof catalogo>, opcionIds: string[], cantidad = 1) => ({
      producto_venta_id: c.pote.id, cantidad,
      modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: opcionIds }],
    });

    it('reutiliza la misma venta, reemplaza las líneas y descuenta el stock una sola vez', () => {
      const { c, caja } = preparar();
      const ventaId = armarPedido(caja.id, { lineas: [potes(c, [c.opChoco.id], 2)] });
      expect(stockDe(db, c.envase.id)).toBe(10); // guardar no toca stock
      expect(db.select().from(schema.venta_linea).all()).toHaveLength(1);

      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID, venta_en_espera_id: ventaId,
        lineas: [potes(c, [c.opChoco.id, c.opDdl.id]), { producto_venta_id: c.palito.id, cantidad: 1 }],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 270000 }],
      });
      expect(r.venta.id).toBe(ventaId);
      expect(r.venta.estado).toBe('confirmada');
      expect(r.venta.numero_interno).toBe('V-C1-000001');
      expect(r.venta.numero_interno.startsWith('HOLD:')).toBe(false);

      const lineas = db.select().from(schema.venta_linea).where(eq(schema.venta_linea.venta_id, ventaId)).all();
      expect(lineas.map((l) => l.descripcion).sort()).toEqual(['Palito', 'Pote 1/4']);
      expect(r.lineas).toHaveLength(2);
      expect(r.lineas.find((l) => l.descripcion === 'Pote 1/4')!.modificadores).toHaveLength(2);
      expect(db.select().from(schema.venta_linea_modificador).all()).toHaveLength(2); // los del pedido original se borraron

      expect(stockDe(db, c.envase.id)).toBe(9);
      expect(stockDe(db, c.palitoArt.id)).toBe(1);
      expect(db.select().from(schema.movimiento_articulo).all().filter((m) => m.motivo === 'venta')).toHaveLength(4);
    });

    it('venta_en_espera_id inexistente → VENTA_ESPERA_NOT_FOUND; de una venta confirmada → VENTA_NO_EN_ESPERA', () => {
      const { c, caja } = preparar();
      const base = {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }],
      };
      expect(() => ventaConfirmarHandler(db, { ...base, venta_en_espera_id: 'no-existe' })).toThrow('VENTA_ESPERA_NOT_FOUND');
      const hecha = ventaConfirmarHandler(db, base);
      expect(() => ventaConfirmarHandler(db, { ...base, venta_en_espera_id: hecha.venta.id })).toThrow('VENTA_NO_EN_ESPERA');
    });

    it('guardar un pedido no crea movimientos de artículo, de caja ni pagos', () => {
      const { c, caja } = preparar();
      armarPedido(caja.id, { lineas: [potes(c, [c.opChoco.id])] });
      expect(db.select().from(schema.movimiento_articulo).all().filter((m) => m.motivo === 'venta')).toHaveLength(0);
      expect(db.select().from(schema.movimiento_caja).all().filter((m) => m.motivo === 'venta')).toHaveLength(0);
      expect(db.select().from(schema.venta_pago).all()).toHaveLength(0);
      expect(stockDe(db, c.envase.id)).toBe(10);
    });
  });

  describe('ventaAnularHandler / ventaGetHandler', () => {
    function ventaHecha() {
      loginAsAdmin(db);
      const c = catalogo(db);
      const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
      const r = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [
          { producto_venta_id: c.pote.id, cantidad: 2,
            modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: [c.opChoco.id, c.opDdl.id] }] },
          { producto_venta_id: c.palito.id, cantidad: 1 },
        ],
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 2 * 170000 + 100000 }],
      });
      return { c, caja, r };
    }

    it('anula y restituye exactamente el stock descontado, con movimientos inversos', () => {
      const { c, r } = ventaHecha();
      expect(stockDe(db, c.palitoArt.id)).toBe(1);
      const anulada = ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'error de carga', supervisor_credenciales: SUP });
      expect(anulada.estado).toBe('anulada');
      expect(stockDe(db, c.envase.id)).toBe(10);
      expect(stockDe(db, c.palitoArt.id)).toBe(2);
      expect(stockDe(db, c.choco.id)).toBeCloseTo(5, 6);
      expect(stockDe(db, c.ddl.id)).toBeCloseTo(5, 6);
      const inversos = db.select().from(schema.movimiento_articulo)
        .where(eq(schema.movimiento_articulo.referencia_id, r.venta.id)).all()
        .filter((m) => m.motivo === 'anulacion_venta');
      expect(inversos).toHaveLength(4);
      expect(inversos.every((m) => m.tipo === 'entrada' && m.cantidad > 0)).toBe(true);
    });

    it('no recalcula: restituye lo descontado aunque la receta cambie después de vender', () => {
      const { c, r } = ventaHecha();
      db.update(schema.producto_venta_grupo).set({ cantidad_total: 0.9 }).run(); // cambia el consumo del pote
      ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'x', supervisor_credenciales: SUP });
      expect(stockDe(db, c.choco.id)).toBeCloseTo(5, 6);
    });

    it('errores: credenciales inválidas, ya anulada, motivo vacío', () => {
      const { r } = ventaHecha();
      expect(() => ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'x', supervisor_credenciales: { nombre_usuario: 'admin', password: 'mal' } }))
        .toThrow('SUPERVISOR_INVALIDO');
      expect(() => ventaAnularHandler(db, { venta_id: r.venta.id, motivo: ' ', supervisor_credenciales: SUP })).toThrow('MOTIVO_REQUERIDO');
      ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'x', supervisor_credenciales: SUP });
      expect(() => ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'x', supervisor_credenciales: SUP })).toThrow('VENTA_YA_ANULADA');
    });

    it('anular: motivo > 500 → motivo:MAX:500; motivo no-string → motivo:TIPO', () => {
      const { r } = ventaHecha();
      expect(() => ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 'x'.repeat(501), supervisor_credenciales: SUP })).toThrow('motivo:MAX:500');
      expect(() => ventaAnularHandler(db, { venta_id: r.venta.id, motivo: 5, supervisor_credenciales: SUP })).toThrow('motivo:TIPO');
    });

    it('get valida el id (payload null → error de campo, no TypeError)', () => {
      loginAsAdmin(db);
      expect(() => ventaGetHandler(db, null as never)).toThrow(/^VALIDATION:id:/);
      expect(() => ventaGetHandler(db, { id: 5 } as never)).toThrow(/^VALIDATION:id:/);
    });

    it('get devuelve venta, líneas con modificadores, comprobante y cliente; null si no existe', () => {
      const { r } = ventaHecha();
      const g = ventaGetHandler(db, { id: r.venta.id })!;
      expect(g.venta.id).toBe(r.venta.id);
      expect(g.lineas).toHaveLength(2);
      expect(g.lineas.find((l) => l.descripcion === 'Pote 1/4')!.modificadores).toHaveLength(2);
      expect(g.comprobante?.tipo).toBe('ticket_interno');
      expect(g.cliente?.nombre_completo).toBe('Consumidor Final');
      expect(ventaGetHandler(db, { id: 'no-existe' })).toBeNull();
    });
  });

  describe('ventaCatalogoHandler', () => {
    it('devuelve categorías y productos activos con sus grupos y opciones, listos para el POS', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const r = ventaCatalogoHandler(db);
      expect(r.categorias.map((x) => x.nombre)).toEqual(['Helados']);
      const pote = r.productos.find((p) => p.id === c.pote.id)!;
      expect(pote).toMatchObject({ nombre: 'Pote 1/4', precio_centavos: 150000, categoria_venta_id: r.categorias[0].id });
      expect(pote.grupos).toHaveLength(1);
      expect(pote.grupos[0]).toMatchObject({ grupo_modificador_id: c.grupo.id, nombre: 'Sabores', min: 1, max: 3, modo_descuento: 'reparto' });
      expect(pote.grupos[0].opciones.map((o) => [o.nombre, o.recargo_centavos])).toEqual([['Chocolate', 0], ['Dulce de leche', 20000]]);
      expect(r.productos.find((p) => p.id === c.palito.id)!.grupos).toEqual([]);
    });

    it('omite productos y categorías inactivos y exige sesión', () => {
      expect(() => ventaCatalogoHandler(db)).toThrow('UNAUTHENTICATED');
      loginAsAdmin(db);
      const c = catalogo(db);
      db.update(schema.producto_venta).set({ activo: false }).where(eq(schema.producto_venta.id, c.palito.id)).run();
      expect(ventaCatalogoHandler(db).productos.map((p) => p.id)).toEqual([c.pote.id]);
    });
  });

  describe('ventaCatalogoHandler — cantidad de consultas', () => {
    it('no crece con la cantidad de productos (sin consultas en cascada)', () => {
      loginAsAdmin(db);
      const c = catalogo(db);
      const client = (db as unknown as { $client: { prepare: (...a: unknown[]) => unknown } }).$client;
      const contar = () => {
        const spy = vi.spyOn(client, 'prepare');
        ventaCatalogoHandler(db);
        const n = spy.mock.calls.length;
        spy.mockRestore();
        return n;
      };
      const base = contar();
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        db.insert(schema.producto_venta).values({
          id: generateId(), nombre: `Extra ${i}`, categoria_venta_id: c.pote.categoria_venta_id,
          precio_centavos: 1000, impuesto_id: c.pote.impuesto_id, activo: true,
          version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
        } as never).run();
      }
      expect(contar()).toBe(base);
      expect(base).toBeLessThanOrEqual(5);
    });
  });

  describe('registerVentaHandlers', () => {
    it('registra los 6 canales venta:*', () => {
      const handle = vi.fn();
      registerVentaHandlers({ handle } as never, db);
      expect(handle.mock.calls.map((c) => c[0]).sort()).toEqual(
        ['venta:anular', 'venta:catalogo', 'venta:confirmar', 'venta:cotizar', 'venta:get', 'venta:listByCaja'],
      );
    });
  });
});
