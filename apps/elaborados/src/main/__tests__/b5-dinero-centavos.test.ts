import { describe, it, expect } from 'vitest';
import { columnasRealesNoDeclaradas } from '@core/db';
import * as schema from '../db/schema';

// B5 (ADR-157, PR-C4): el dinero va en centavos enteros. Estas son las únicas columnas REAL del
// esquema compuesto (núcleo + Elaborados) y ninguna es dinero: cantidades, stock, factores y
// porcentajes. Agregar una REAL nueva obliga a declararla acá; si es dinero, va en `*_centavos`.
const REALES_SIN_DINERO: readonly string[] = [
  'articulo.stock_minimo',
  'compra_item.cantidad',
  'existencia_articulo.stock',
  'grupo_modificador_opcion.cantidad',
  'impuesto.alicuota',
  'lista_precio.ajuste_porcentual',
  'movimiento_articulo.cantidad',
  'movimiento_articulo.stock_resultante',
  'produccion.cantidad_producida',
  'producto_venta_componente.cantidad',
  'producto_venta_grupo.cantidad_total',
  'proveedor.bonificacion_pct_default',
  'proveedor.costo_financiero_pct_default',
  'proveedor.flete_pct_default',
  'receta_produccion.rinde_cantidad',
  'receta_produccion_item.cantidad',
  'venta.descuento_global',
  'venta_linea.alicuota_iva',
  'venta_linea.cantidad',
  'venta_linea.descuento_linea_pct',
  'venta_linea_modificador.cantidad_consumida',
  'venta_pago.recargo_pct',
];

describe('B5 — sin dinero en columnas REAL (Elaborados)', () => {
  it('toda columna REAL está declarada como no-dinero', () => {
    expect(columnasRealesNoDeclaradas(schema, REALES_SIN_DINERO)).toEqual([]);
  });
});
