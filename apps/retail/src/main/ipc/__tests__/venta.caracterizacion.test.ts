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
import {
  ventaConfirmarHandler, ventaAnularHandler, type VentaConfirmarPayload,
} from '../venta';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

describe('venta — caracterización previa a E3a', () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
  });

  function prepararProducto() {
    loginAsAdmin(db);
    const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
    const imp = db.select().from(schema.impuesto)
      .where(eq(schema.impuesto.predeterminado, true)).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 1000,
    });
    stockEntradaHandler(db, { producto_id: prod.id, cantidad: 10 });
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    return { prod, caja };
  }

  function payload(cajaId: string, prodId: string): VentaConfirmarPayload {
    return {
      caja_id: cajaId, cliente_id: CF_ID,
      lineas: [{
        producto_id: prodId, descripcion: 'Tornillo', cantidad: 1,
        precio_unitario: 1000, descuento_linea: 0, alicuota_iva: 21, subtotal: 1000,
      }],
      descuento_global: 0, subtotal: 1000, importe_iva: 173.55, total: 1000, ajuste_redondeo: 0,
      pagos: [{ medio_pago: 'efectivo', monto_centavos: 100000 }],
    };
  }

  it('confirmar con pagos vacíos → PAGOS_REQUERIDOS', () => {
    const { prod, caja } = prepararProducto();
    const p = payload(caja.id, prod.id);
    p.pagos = [];
    expect(() => ventaConfirmarHandler(db, p)).toThrow('PAGOS_REQUERIDOS');
  });

  it('pago cuenta_corriente sin cuenta del cliente → CCC_NO_DISPONIBLE', () => {
    const { prod, caja } = prepararProducto();
    const p = payload(caja.id, prod.id);
    p.pagos = [{ medio_pago: 'cuenta_corriente', monto_centavos: 100000 }];
    expect(() => ventaConfirmarHandler(db, p)).toThrow('CCC_NO_DISPONIBLE');
  });

  it('anular venta inexistente → NOT_FOUND', () => {
    prepararProducto();
    expect(() => ventaAnularHandler(db, {
      venta_id: generateId(), motivo: 'x', supervisor_credenciales: SUP,
    })).toThrow('NOT_FOUND');
  });

  it('anular venta en_espera → VENTA_NO_CONFIRMADA', () => {
    const { prod, caja } = prepararProducto();
    const ventaId = generateId();
    const now = new Date();
    const adminId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
    db.insert(schema.venta).values({
      id: ventaId, numero_interno: 'HOLD:test', fecha: now, cliente_id: CF_ID,
      usuario_id: adminId, caja_id: caja.id, subtotal: 1000, descuento_global: 0,
      importe_iva: 0, total: 1000, ajuste_redondeo: 0, forma_pago: 'efectivo',
      estado: 'en_espera', usuario_creacion_id: adminId, fecha_creacion: now,
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
    }).run();
    void prod;
    expect(() => ventaAnularHandler(db, {
      venta_id: ventaId, motivo: 'x', supervisor_credenciales: SUP,
    })).toThrow('VENTA_NO_CONFIRMADA');
  });

  it('confirmar con venta_en_espera_id inexistente → VENTA_ESPERA_NOT_FOUND', () => {
    const { prod, caja } = prepararProducto();
    expect(() => ventaConfirmarHandler(db, {
      ...payload(caja.id, prod.id), venta_en_espera_id: generateId(),
    })).toThrow('VENTA_ESPERA_NOT_FOUND');
  });

  it('confirmar con venta_en_espera_id de una venta ya confirmada → VENTA_NO_EN_ESPERA', () => {
    const { prod, caja } = prepararProducto();
    const { venta } = ventaConfirmarHandler(db, payload(caja.id, prod.id));
    expect(() => ventaConfirmarHandler(db, {
      ...payload(caja.id, prod.id), venta_en_espera_id: venta.id,
    })).toThrow('VENTA_NO_EN_ESPERA');
  });

  it('anular venta legacy sin venta_pago → un egreso por venta.total', () => {
    const { prod, caja } = prepararProducto();
    const { venta } = ventaConfirmarHandler(db, payload(caja.id, prod.id));
    db.delete(schema.venta_pago).where(eq(schema.venta_pago.venta_id, venta.id)).run();

    ventaAnularHandler(db, { venta_id: venta.id, motivo: 'legacy', supervisor_credenciales: SUP });

    const egresos = db.select().from(schema.movimiento_caja)
      .where(eq(schema.movimiento_caja.referencia_id, venta.id)).all()
      .filter(m => m.tipo === 'egreso');
    expect(egresos).toHaveLength(1);
    expect(egresos[0].monto).toBe(1000);
    expect(egresos[0].observaciones).toBe('legacy');
  });
});
