import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { cajaAbrirHandler } from '@core/main';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from '../../__tests__/helpers';
import { CONSUMIDOR_FINAL_ID } from '../../catalog/seed';
import { catalogo } from './ventaFixtures';
import { articuloCreateHandler } from '../articulo';
import { movimientoArticuloCreateHandler } from '../movimiento-articulo';
import { ventaConfirmarHandler, ventaAnularHandler } from '../venta';
import { ventaEsperaPausarHandler } from '../venta-espera';
import {
  rangoDe, reporteVentasPeriodoQuery, reporteVentasProductoQuery, reporteStockAlertasQuery,
} from '../reporte';

type Db = ReturnType<typeof setupDb>;
const SUP = { nombre_usuario: 'admin', password: 'admin1234' }; // NOSONAR

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const RANGO_HOY = () => ({ desde: hoy(), hasta: hoy() });

describe('rangoDe', () => {
  it('cubre el día completo en hora local', () => {
    const { desde, hasta } = rangoDe({ desde: '2026-03-01', hasta: '2026-03-02' });
    expect(desde.getHours()).toBe(0);
    expect(hasta.getHours()).toBe(23);
    expect(hasta.getDate()).toBe(2);
  });
  it('rechaza formato inválido, fecha inexistente y rango invertido', () => {
    expect(() => rangoDe({ desde: '01/03/2026', hasta: '2026-03-02' })).toThrow('VALIDATION:desde:TIPO');
    expect(() => rangoDe({ desde: '2026-02-30', hasta: '2026-03-02' })).toThrow('VALIDATION:desde:TIPO');
    expect(() => rangoDe({ desde: '2026-03-03', hasta: '2026-03-02' })).toThrow('VALIDATION:desde:RANGO');
    expect(() => rangoDe({})).toThrow();
  });
});

describe('reportes (Elaborados)', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  function preparar() {
    loginAsAdmin(db);
    const c = catalogo(db);
    const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
    const vender = (lineas: unknown[], pagos: unknown[]) => ventaConfirmarHandler(db, {
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID, lineas, pagos,
    });
    return { c, caja, vender };
  }

  it('ventas por período: total, neto, costo histórico y margen; medios netos de vuelto', () => {
    const { c, vender } = preparar();
    // 1 palito: $1000 con IVA; costo = 1 envase de palito a $1,00 (100 centavos) del movimiento de venta.
    const r1 = vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'efectivo', monto_centavos: 150000 }]);
    vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'tarjeta', monto_centavos: 100000 }]);

    const r = reporteVentasPeriodoQuery(db, RANGO_HOY());
    expect(r.resumen.cantidad).toBe(2);
    expect(r.resumen.total_centavos).toBe(200000);
    expect(r.resumen.costo_centavos).toBe(200);
    const iva = Math.round(r1.venta.importe_iva * 100);
    expect(r.resumen.neto_centavos).toBe(200000 - 2 * iva);
    expect(r.resumen.margen_centavos).toBe(r.resumen.neto_centavos - 200);
    expect(r.por_dia).toHaveLength(1);
    expect(r.por_dia[0]).toMatchObject({ dia: hoy(), cantidad: 2, total_centavos: 200000 });
    expect(r.por_medio).toEqual([
      { medio_pago: 'efectivo', monto_centavos: 100000 }, // 150000 entregados − 50000 de vuelto
      { medio_pago: 'tarjeta', monto_centavos: 100000 },
    ].sort((a, b) => b.monto_centavos - a.monto_centavos));
  });

  it('el costo es el del momento de la venta, no el costo actual', () => {
    const { c, vender } = preparar();
    vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'efectivo', monto_centavos: 100000 }]);
    // el costo promedio sube después: el margen histórico no cambia
    movimientoArticuloCreateHandler(db, { articulo_id: c.palitoArt.id, motivo: 'compra', cantidad: 10, costo_unitario_centavos: 5000 });
    const r = reporteVentasPeriodoQuery(db, RANGO_HOY());
    expect(r.resumen.costo_centavos).toBe(100);
  });

  it('solo cuentan las confirmadas: anuladas, pedidos en espera y fuera de rango no', () => {
    const { c, caja, vender } = preparar();
    vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'efectivo', monto_centavos: 100000 }]);
    const anulada = vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'efectivo', monto_centavos: 100000 }]);
    ventaAnularHandler(db, { venta_id: anulada.venta.id, motivo: 'error', supervisor_credenciales: SUP });
    ventaEsperaPausarHandler(db, {
      caja_id: caja.id, cliente_id: CONSUMIDOR_FINAL_ID, alias: 'Ana',
      lineas: [{ producto_venta_id: c.palito.id, cantidad: 1 }],
    });
    const vieja = vender([{ producto_venta_id: c.palito.id, cantidad: 1 }], [{ medio_pago: 'efectivo', monto_centavos: 100000 }]);
    db.update(schema.venta).set({ fecha: new Date(2020, 0, 15, 12) }).where(eq(schema.venta.id, vieja.venta.id)).run();

    const r = reporteVentasPeriodoQuery(db, RANGO_HOY());
    expect(r.resumen.cantidad).toBe(1);
    expect(r.resumen.total_centavos).toBe(100000);
    const rv = reporteVentasProductoQuery(db, RANGO_HOY());
    expect(rv.productos).toEqual([expect.objectContaining({ descripcion: 'Palito', unidades: 1, importe_centavos: 100000 })]);

    const historico = reporteVentasPeriodoQuery(db, { desde: '2020-01-01', hasta: '2020-01-31' });
    expect(historico.resumen.cantidad).toBe(1);
    expect(historico.por_dia[0]!.dia).toBe('2020-01-15');
  });

  it('período vacío devuelve ceros', () => {
    preparar();
    const r = reporteVentasPeriodoQuery(db, { desde: '2001-01-01', hasta: '2001-01-02' });
    expect(r).toEqual({
      resumen: { cantidad: 0, total_centavos: 0, neto_centavos: 0, costo_centavos: 0, margen_centavos: 0 },
      por_dia: [], por_medio: [],
    });
  });

  it('ventas por producto y ranking de sabores', () => {
    const { c, vender } = preparar();
    const pote = (cantidad: number, opciones: string[]) => ({
      producto_venta_id: c.pote.id, cantidad,
      modificadores: [{ grupo_modificador_id: c.grupo.id, opcion_ids: opciones }],
    });
    vender([pote(2, [c.opChoco.id, c.opDdl.id]), { producto_venta_id: c.palito.id, cantidad: 1 }],
      [{ medio_pago: 'efectivo', monto_centavos: 2 * 170000 + 100000 }]);
    vender([pote(1, [c.opChoco.id])], [{ medio_pago: 'efectivo', monto_centavos: 150000 }]);

    const r = reporteVentasProductoQuery(db, RANGO_HOY());
    const potes = r.productos.find((p) => p.descripcion === 'Pote 1/4')!;
    expect(potes.unidades).toBe(3);
    expect(r.productos[0]!.importe_centavos).toBeGreaterThanOrEqual(r.productos[1]!.importe_centavos);
    expect(r.sabores.map((s) => [s.descripcion, s.veces])).toEqual([['Chocolate', 3], ['Dulce de leche', 2]]);
    const choco = r.sabores.find((s) => s.descripcion === 'Chocolate')!;
    expect(choco.consumo).toBeGreaterThan(0);
  });

  it('stock: negativos primero (más profundos arriba) y luego bajo mínimo; ignora inactivos y OK', () => {
    loginAsAdmin(db);
    const mk = (nombre: string, stock_minimo: number | null) =>
      articuloCreateHandler(db, { nombre, tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: false, stock_minimo });
    const a = mk('Azúcar', 5);
    const b = mk('Leche', 5);
    const c2 = mk('Harina', 5);
    const d = mk('Sal', null);
    const e = mk('Cacao', 5);
    movimientoArticuloCreateHandler(db, { articulo_id: a.id, motivo: 'compra', cantidad: 3, costo_unitario_centavos: 1 }); // bajo mínimo
    movimientoArticuloCreateHandler(db, { articulo_id: b.id, motivo: 'merma', cantidad: -2 }); // negativo
    movimientoArticuloCreateHandler(db, { articulo_id: c2.id, motivo: 'compra', cantidad: 50, costo_unitario_centavos: 1 }); // OK
    movimientoArticuloCreateHandler(db, { articulo_id: d.id, motivo: 'merma', cantidad: -1 }); // negativo sin mínimo
    db.update(schema.articulo).set({ activo: false }).where(eq(schema.articulo.id, e.id)).run();

    const r = reporteStockAlertasQuery(db);
    expect(r.map((x) => [x.nombre, x.estado])).toEqual([
      ['Leche', 'negativo'], ['Sal', 'negativo'], ['Azúcar', 'bajo_minimo'],
    ]);
  });

  it('exigen sesión', () => {
    expect(() => reporteVentasPeriodoQuery(db, RANGO_HOY())).toThrow('UNAUTHENTICATED');
    expect(() => reporteStockAlertasQuery(db)).toThrow('UNAUTHENTICATED');
  });
});
