import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import {
  cajaAbrirHandler, confirmarVenta, pausarVentaEspera, descartarVentaEspera, listarVentasEspera,
  type PausarVentaEsperaInput,
} from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';

type Db = ReturnType<typeof setupDb>;

function crearCliente(db: Db) {
  const clienteId = generateId();
  const now = new Date();
  const sync = { version: 1 as const, origin_id: 'test', sync_state: 'pending' as const, updated_at: now };
  const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  db.insert(schema.cliente).values({
    id: clienteId, tipo_documento: 'DNI', numero_documento: '11111111',
    nombre: 'Cli', apellido: 'Test', condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: false, activo: true,
    usuario_creacion_id: adminId, fecha_creacion: now, ...sync,
  }).run();
  return { clienteId };
}

function input(cajaId: string, clienteId: string, over: Partial<PausarVentaEsperaInput> = {}): PausarVentaEsperaInput {
  return {
    caja_id: cajaId, cliente_id: clienteId,
    subtotal: 500, descuento_global: 0, importe_iva: 86.78, total: 500, ajuste_redondeo: 0,
    ...over,
  };
}

function setParam(db: Db, clave: string, valor: string) {
  db.insert(schema.parametros_sistema).values({
    clave, valor, tipo: 'number', descripcion: clave, actualizado_en: new Date(),
  }).run();
}

describe('venta en espera (core)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function preparar() {
    loginAsAdmin(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const { clienteId } = crearCliente(db);
    return { caja, clienteId };
  }

  describe('pausarVentaEspera', () => {
    it('crea una venta en_espera sin tocar caja ni pagos ni comprobante', () => {
      const { caja, clienteId } = preparar();
      const aplicarLineas = vi.fn();
      const { venta_id } = pausarVentaEspera(db,
        input(caja.id, clienteId, { alias: 'Mesa 3', observaciones: 'sin sal' }), { aplicarLineas });

      const v = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
      expect(v.estado).toBe('en_espera');
      expect(v.numero_interno).toMatch(/^HOLD:.{8}$/);
      expect(v.alias).toBe('Mesa 3');
      expect(v.observaciones).toBe('sin sal');
      expect(v.en_espera_desde).toBeInstanceOf(Date);
      expect(v.turno_creacion_id).toBe(caja.id);
      expect(v.total).toBe(500);
      expect(v.subtotal).toBe(500);
      expect(v.forma_pago).toBe('efectivo');
      expect(aplicarLineas).toHaveBeenCalledTimes(1);
      expect(aplicarLineas.mock.calls[0][1]).toMatchObject({ ventaId: venta_id, esRetoma: false });
      expect(db.select().from(schema.movimiento_caja).all()).toHaveLength(0);
      expect(db.select().from(schema.venta_pago).all()).toHaveLength(0);
      expect(db.select().from(schema.comprobante).all()).toHaveLength(0);
    });

    it('errores: UNAUTHENTICATED, CAJA_REQUERIDA, MAX_EN_ESPERA y rollback si falla el hook', () => {
      expect(() => pausarVentaEspera(db, input('x', 'y'), { aplicarLineas: vi.fn() }))
        .toThrow('UNAUTHENTICATED');

      const { caja, clienteId } = preparar();
      const hooks = { aplicarLineas: vi.fn() };
      expect(() => pausarVentaEspera(db, input('inexistente', clienteId), hooks))
        .toThrow('CAJA_REQUERIDA');

      setParam(db, 'pos.ventas_en_espera.max', '2');
      pausarVentaEspera(db, input(caja.id, clienteId), hooks);
      pausarVentaEspera(db, input(caja.id, clienteId), hooks);
      expect(() => pausarVentaEspera(db, input(caja.id, clienteId), hooks)).toThrow('MAX_EN_ESPERA');

      const db2 = setupDb();
      loginAsAdmin(db2);
      const caja2 = cajaAbrirHandler(db2, { monto_inicial: 0 });
      const { clienteId: cli2 } = crearCliente(db2);
      expect(() => pausarVentaEspera(db2, input(caja2.id, cli2), {
        aplicarLineas: () => { throw new Error('BOOM'); },
      })).toThrow('BOOM');
      expect(db2.select().from(schema.venta).all()).toHaveLength(0);
    });

    it('CAJA_REQUERIDA con la caja cerrada', () => {
      const { caja, clienteId } = preparar();
      db.update(schema.caja).set({ estado: 'cerrada' }).where(eq(schema.caja.id, caja.id)).run();
      expect(() => pausarVentaEspera(db, input(caja.id, clienteId), { aplicarLineas: vi.fn() }))
        .toThrow('CAJA_REQUERIDA');
    });

    it('con venta_id actualiza en el lugar', () => {
      const { caja, clienteId } = preparar();
      const aplicarLineas = vi.fn();
      setParam(db, 'pos.ventas_en_espera.max', '1');
      const { venta_id } = pausarVentaEspera(db, input(caja.id, clienteId, { alias: 'A' }), { aplicarLineas });
      const antes = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;

      // el tope (1) ya esta alcanzado: la actualizacion no lo aplica
      const r = pausarVentaEspera(db,
        input(caja.id, clienteId, { venta_id, alias: 'B', total: 900, subtotal: 900 }), { aplicarLineas });
      expect(r.venta_id).toBe(venta_id);

      const filas = db.select().from(schema.venta).all();
      expect(filas).toHaveLength(1);
      const desp = filas[0]!;
      expect(desp.id).toBe(venta_id);
      expect(desp.numero_interno).toBe(antes.numero_interno);
      expect(desp.en_espera_desde?.getTime()).toBe(antes.en_espera_desde?.getTime());
      expect(desp.alias).toBe('B');
      expect(desp.total).toBe(900);
      expect(desp.version).toBe(antes.version + 1);
      expect(aplicarLineas).toHaveBeenCalledTimes(2);
      expect(aplicarLineas.mock.calls[1][1]).toMatchObject({ ventaId: venta_id, esRetoma: true });
    });

    it('con venta_id: inexistente -> VENTA_ESPERA_NOT_FOUND; confirmada -> VENTA_NO_EN_ESPERA', () => {
      const { caja, clienteId } = preparar();
      const hooks = { aplicarLineas: vi.fn() };
      expect(() => pausarVentaEspera(db, input(caja.id, clienteId, { venta_id: 'nope' }), hooks))
        .toThrow('VENTA_ESPERA_NOT_FOUND');

      const { venta } = confirmarVenta(db, {
        caja_id: caja.id, cliente_id: clienteId,
        subtotal: 500, descuento_global: 0, importe_iva: 86.78, total: 500, ajuste_redondeo: 0,
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 50000 }],
      }, hooks);
      expect(() => pausarVentaEspera(db, input(caja.id, clienteId, { venta_id: venta.id }), hooks))
        .toThrow('VENTA_NO_EN_ESPERA');
    });
  });

  describe('descartarVentaEspera', () => {
    it('pasa a descartada y valida existencia/estado', () => {
      const { caja, clienteId } = preparar();
      const hooks = { aplicarLineas: vi.fn() };
      const { venta_id } = pausarVentaEspera(db, input(caja.id, clienteId), hooks);

      expect(descartarVentaEspera(db, venta_id)).toEqual({ ok: true });
      const v = db.select().from(schema.venta).where(eq(schema.venta.id, venta_id)).get()!;
      expect(v.estado).toBe('descartada');

      expect(() => descartarVentaEspera(db, venta_id)).toThrow('VENTA_NO_EN_ESPERA');
      expect(() => descartarVentaEspera(db, 'nope')).toThrow('VENTA_ESPERA_NOT_FOUND');
    });
  });

  describe('listarVentasEspera', () => {
    it('solo en_espera, por antiguedad ascendente, con vencida segun TTL', () => {
      const { caja, clienteId } = preparar();
      const hooks = { aplicarLineas: vi.fn() };
      setParam(db, 'pos.ventas_en_espera.ttl_horas', '1');
      const a = pausarVentaEspera(db, input(caja.id, clienteId, { alias: 'reciente', observaciones: 'obs' }), hooks);
      const b = pausarVentaEspera(db, input(caja.id, clienteId, { alias: 'vieja' }), hooks);
      const c = pausarVentaEspera(db, input(caja.id, clienteId, { alias: 'descartada' }), hooks);
      descartarVentaEspera(db, c.venta_id);
      confirmarVenta(db, {
        caja_id: caja.id, cliente_id: clienteId,
        subtotal: 500, descuento_global: 0, importe_iva: 86.78, total: 500, ajuste_redondeo: 0,
        pagos: [{ medio_pago: 'efectivo', monto_centavos: 50000 }],
      }, hooks);
      db.update(schema.venta).set({ en_espera_desde: new Date(Date.now() - 2 * 3600 * 1000) })
        .where(eq(schema.venta.id, b.venta_id)).run();

      const lista = listarVentasEspera(db, () => 3);
      expect(lista.map(x => x.id)).toEqual([b.venta_id, a.venta_id]);
      expect(lista[0]).toMatchObject({ alias: 'vieja', vencida: true, total: 500, count_items: 3 });
      expect(lista[1]).toMatchObject({ alias: 'reciente', observaciones: 'obs', vencida: false });
    });

    it('sin sesion -> UNAUTHENTICATED', () => {
      expect(() => listarVentasEspera(db, () => 0)).toThrow('UNAUTHENTICATED');
    });
  });
});
