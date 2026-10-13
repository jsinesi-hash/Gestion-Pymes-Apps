import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID } from '../../catalog/seed';
import { cajaAbrirHandler } from '@core/main';
import { catalogo, stockDe } from './ventaFixtures';
import {
  ventaEsperaPausarHandler, ventaEsperaListarHandler, ventaEsperaRetomarHandler,
  ventaEsperaDescartarHandler, registerVentaEsperaHandlers,
} from '../venta-espera';
import { ventaConfirmarHandler } from '../venta';

type Db = ReturnType<typeof setupDb>;

function setParam(db: Db, clave: string, valor: string) {
  db.insert(schema.parametros_sistema)
    .values({ clave, valor, tipo: 'number', descripcion: clave, actualizado_en: new Date() })
    .onConflictDoUpdate({ target: schema.parametros_sistema.clave, set: { valor } })
    .run();
}

describe('venta.espera handlers (Elaborados)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function armar() {
    loginAsAdmin(db);
    const c = catalogo(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const lineaPote = (opciones: string[]) => ({
      producto_venta_id: c.pote.id, cantidad: 1,
      modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: opciones }],
    });
    const payload = (extra: Record<string, unknown> = {}) => ({
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
      lineas: [lineaPote([c.opChoco.id, c.opDdl.id])], ...extra,
    });
    return { c, caja, lineaPote, payload };
  }

  describe('pausar', () => {
    it('guarda el pedido valorizado, sin stock, caja ni pagos', () => {
      const { c, payload } = armar();
      const { venta_id } = ventaEsperaPausarHandler(db, payload({
        alias: 'Mesa 3', observaciones: 'sin cono', descuento_global_pct: 10,
      }));
      const v = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
      expect(v.estado).toBe('en_espera');
      expect(v.numero_interno.startsWith('HOLD:')).toBe(true);
      expect(v.alias).toBe('Mesa 3');
      expect(v.observaciones).toBe('sin cono');
      expect(v.descuento_global).toBe(10);
      expect(v.total).toBeGreaterThan(0);
      const lineas = db.select().from(schema.venta_linea).where(eq(schema.venta_linea.venta_id, venta_id)).all();
      expect(lineas).toHaveLength(1);
      expect(db.select().from(schema.venta_linea_modificador).all()).toHaveLength(2);
      expect(db.select().from(schema.movimiento_articulo).all().filter((m) => m.motivo === 'venta')).toHaveLength(0);
      expect(db.select().from(schema.movimiento_caja).all()).toHaveLength(0);
      expect(db.select().from(schema.venta_pago).all()).toHaveLength(0);
      expect(stockDe(db, c.envase.id)).toBe(10);
      expect(stockDe(db, c.choco.id)).toBe(5);
    });

    it('con venta_id actualiza en el lugar y reemplaza las líneas', () => {
      const { c, lineaPote, payload } = armar();
      const { venta_id } = ventaEsperaPausarHandler(db, payload({ alias: 'A' }));
      const antes = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
      const r = ventaEsperaPausarHandler(db, payload({
        venta_id, alias: 'B', lineas: [lineaPote([c.opChoco.id]), lineaPote([c.opDdl.id])],
      }));
      expect(r.venta_id).toBe(venta_id);
      const despues = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
      expect(despues.numero_interno).toBe(antes.numero_interno);
      expect(despues.alias).toBe('B');
      expect(db.select().from(schema.venta).all()).toHaveLength(1);
      expect(db.select().from(schema.venta_linea).all()).toHaveLength(2);
      expect(db.select().from(schema.venta_linea_modificador).all()).toHaveLength(2);
    });

    it('no valida stock (guarda lo que bloquearía al cobrar)', () => {
      const { c, caja } = armar();
      const r = ventaEsperaPausarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.palito.id, cantidad: 50 }], // stock 2, bloquea
      });
      expect(r.venta_id).toBeTruthy();
      expect(stockDe(db, c.palitoArt.id)).toBe(2);
    });

    it('valida el carrito contra el catálogo', () => {
      const { c, caja } = armar();
      expect(() => ventaEsperaPausarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID,
        lineas: [{ producto_venta_id: c.pote.id, cantidad: 1, modificadores: [] }],
      })).toThrow('MODIFICADOR_MIN');
      expect(() => ventaEsperaPausarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID, lineas: [],
      })).toThrow('CARRITO_VACIO');
    });

    it('MAX_EN_ESPERA, CAJA_REQUERIDA y UNAUTHENTICATED', () => {
      const { payload } = armar();
      setParam(db, 'pos.ventas_en_espera.max', '1');
      ventaEsperaPausarHandler(db, payload());
      expect(() => ventaEsperaPausarHandler(db, payload())).toThrow('MAX_EN_ESPERA');
      expect(() => ventaEsperaPausarHandler(db, payload({ caja_id: 'no-existe' }))).toThrow('CAJA_REQUERIDA');
      clearSession();
      expect(() => ventaEsperaPausarHandler(db, payload())).toThrow('UNAUTHENTICATED');
    });
  });

  describe('listar', () => {
    it('devuelve pendientes con count_items y vencida; excluye confirmadas y descartadas', () => {
      const { c, lineaPote, payload } = armar();
      setParam(db, 'pos.ventas_en_espera.ttl_horas', '1');
      const a = ventaEsperaPausarHandler(db, payload({ alias: 'Vieja', observaciones: 'obs' }));
      const b = ventaEsperaPausarHandler(db, payload({ alias: 'Dos lineas', lineas: [lineaPote([c.opChoco.id]), lineaPote([c.opDdl.id])] }));
      const d = ventaEsperaPausarHandler(db, payload({ alias: 'Descartada' }));
      ventaEsperaDescartarHandler(db, { venta_id: d.venta_id });
      db.update(schema.venta).set({ en_espera_desde: new Date(Date.now() - 2 * 3600 * 1000) })
        .where(eq(schema.venta.id, a.venta_id)).run();

      const lista = ventaEsperaListarHandler(db);
      expect(lista).toHaveLength(2);
      const va = lista.find((x) => x.id === a.venta_id)!;
      expect(va.alias).toBe('Vieja');
      expect(va.observaciones).toBe('obs');
      expect(va.total).toBeGreaterThan(0);
      expect(va.count_items).toBe(1);
      expect(va.vencida).toBe(true);
      const vb = lista.find((x) => x.id === b.venta_id)!;
      expect(vb.count_items).toBe(2);
      expect(vb.vencida).toBe(false);
    });
  });

  describe('retomar', () => {
    it('devuelve el carrito con los sabores agrupados por grupo y el cliente', () => {
      const { c, payload } = armar();
      const { venta_id } = ventaEsperaPausarHandler(db, payload({
        alias: 'Mesa 1', observaciones: 'x', descuento_global_pct: 5,
      }));
      const r = ventaEsperaRetomarHandler(db, { venta_id });
      expect(r.venta_id).toBe(venta_id);
      expect(r.alias).toBe('Mesa 1');
      expect(r.observaciones).toBe('x');
      expect(r.descuento_global_pct).toBe(5);
      expect(r.cliente).toMatchObject({ id: CONSUMIDOR_FINAL_ID, habilita_cuenta_corriente: false });
      expect(r.cliente!.nombre_completo).toBeTruthy();
      expect(r.lineas).toHaveLength(1);
      const l = r.lineas[0];
      expect(l.producto_venta_id).toBe(c.pote.id);
      expect(l.nombre).toBe('Pote 1/4');
      expect(l.cantidad).toBe(1);
      expect(l.descuento_linea_pct).toBe(0);
      expect(l.modificadores).toHaveLength(1);
      expect(l.modificadores[0].grupo_modificador_id).toBe(c.grupo.id);
      expect([...l.modificadores[0].opcion_ids].sort()).toEqual([c.opChoco.id, c.opDdl.id].sort());
    });

    it('VENTA_ESPERA_NOT_FOUND y VENTA_NO_EN_ESPERA', () => {
      const { payload } = armar();
      expect(() => ventaEsperaRetomarHandler(db, { venta_id: 'nope' })).toThrow('VENTA_ESPERA_NOT_FOUND');
      const { venta_id } = ventaEsperaPausarHandler(db, payload());
      ventaEsperaDescartarHandler(db, { venta_id });
      expect(() => ventaEsperaRetomarHandler(db, { venta_id })).toThrow('VENTA_NO_EN_ESPERA');
    });
  });

  describe('descartar', () => {
    it('pasa a descartada y deja de listarse', () => {
      const { payload } = armar();
      const { venta_id } = ventaEsperaPausarHandler(db, payload());
      expect(ventaEsperaDescartarHandler(db, { venta_id })).toEqual({ ok: true });
      expect(db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!.estado).toBe('descartada');
      expect(ventaEsperaListarHandler(db)).toHaveLength(0);
    });

    it('VENTA_ESPERA_NOT_FOUND y VENTA_NO_EN_ESPERA', () => {
      const { payload } = armar();
      expect(() => ventaEsperaDescartarHandler(db, { venta_id: 'nope' })).toThrow('VENTA_ESPERA_NOT_FOUND');
      const { venta_id } = ventaEsperaPausarHandler(db, payload());
      ventaEsperaDescartarHandler(db, { venta_id });
      expect(() => ventaEsperaDescartarHandler(db, { venta_id })).toThrow('VENTA_NO_EN_ESPERA');
    });
  });

  describe('ciclo completo', () => {
    it('pausar, retomar y confirmar: confirmada, stock descontado una vez, fuera de listar', () => {
      const { c, caja, payload } = armar();
      const { venta_id } = ventaEsperaPausarHandler(db, payload());
      const r = ventaEsperaRetomarHandler(db, { venta_id });
      expect(stockDe(db, c.envase.id)).toBe(10);

      const res = ventaConfirmarHandler(db, {
        caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID, venta_en_espera_id: venta_id,
        lineas: r.lineas.map((l) => ({
          producto_venta_id: l.producto_venta_id, cantidad: l.cantidad,
          descuento_linea_pct: l.descuento_linea_pct, modificadores: l.modificadores,
        })),
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 170000 }],
      });
      expect(res.venta.id).toBe(venta_id);
      expect(res.venta.estado).toBe('confirmada');
      expect(stockDe(db, c.envase.id)).toBe(9);
      expect(db.select().from(schema.movimiento_articulo).all()
        .filter((m) => m.motivo === 'venta' && m.articulo_id === c.envase.id)).toHaveLength(1);
      expect(ventaEsperaListarHandler(db)).toHaveLength(0);
    });
  });

  describe('wiring', () => {
    it('registra los cuatro canales venta.espera:*', () => {
      const ipcMain = { handle: vi.fn() };
      registerVentaEsperaHandlers(ipcMain as never, db);
      expect(ipcMain.handle.mock.calls.map((x) => x[0]).sort()).toEqual([
        'venta.espera:descartar', 'venta.espera:listar', 'venta.espera:pausar', 'venta.espera:retomar',
      ]);
    });
  });
});
