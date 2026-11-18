import { describe, it, expect } from 'vitest';
import { columnasRealesNoDeclaradas } from '@core/db';
import * as schema from '../schema';

// B5 (ADR-157, PR-C4): el dinero va en centavos enteros. Estas son las únicas columnas REAL del
// esquema compuesto (núcleo + Retail) y ninguna es dinero: cantidades, stock, factores y
// porcentajes. Agregar una REAL nueva obliga a declararla acá; si es dinero, va en `*_centavos`.
const REALES_SIN_DINERO: readonly string[] = [
  'cambio_programado.porcentaje',
  'existencias.stock_en_transito',
  'existencias.stock_fisico',
  'existencias.stock_maximo',
  'existencias.stock_minimo',
  'existencias.stock_reservado',
  'impuesto.alicuota',
  'item_oc.alicuota_iva',
  'item_oc.cantidad_pedida',
  'item_oc.cantidad_recibida',
  'lista_precio.ajuste_porcentual',
  'lista_precio_detalle.ajuste_porcentual',
  'movimiento_stock.cantidad',
  'movimiento_stock.stock_resultante',
  'presupuesto.descuento_global_pct',
  'presupuesto_detalle.alicuota_iva',
  'presupuesto_detalle.cantidad',
  'presupuesto_detalle.descuento_linea_pct',
  'price_batch_detalle.margen_anterior_pct',
  'price_batch_detalle.margen_nuevo_pct',
  'price_batch_detalle.variacion_pct',
  'producto.factor_conversion',
  'producto.margen_ganancia',
  'producto_presentacion.factor_a_stock',
  'producto_proveedor.bonificacion_pct',
  'producto_proveedor.costo_financiero_pct',
  'producto_proveedor.flete_pct',
  'proveedor.bonificacion_pct_default',
  'proveedor.costo_financiero_pct_default',
  'proveedor.flete_pct_default',
  'recalculo_masivo.porcentaje',
  'recepcion_detalle.cantidad_recibida',
  'regla_precio.margen_max_pct',
  'regla_precio.margen_min_pct',
  'regla_precio.margen_pct',
  'remito_linea.cantidad_entregada',
  'venta.descuento_global',
  'venta_detalle.alicuota_iva',
  'venta_detalle.cantidad',
  'venta_detalle.descuento_linea',
  'venta_detalle.factor_a_stock_aplicado',
  'venta_pago.recargo_pct',
];

describe('B5 — sin dinero en columnas REAL (Retail)', () => {
  it('toda columna REAL está declarada como no-dinero', () => {
    expect(columnasRealesNoDeclaradas(schema, REALES_SIN_DINERO)).toEqual([]);
  });
});
