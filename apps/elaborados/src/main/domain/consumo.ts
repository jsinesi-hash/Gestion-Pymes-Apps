export type ComponenteFijo = { articulo_id: string; cantidad: number };
export type ModoDescuento = 'reparto' | 'por_opcion' | 'sin_descuento';
export type OpcionElegida = { articulo_id: string; cantidad: number };
export type GrupoConfig = {
  modo_descuento: ModoDescuento;
  cantidad_total: number;
  opciones_elegidas: OpcionElegida[];
};
export type ConsumoLinea = { articulo_id: string; cantidad: number };

/**
 * Redondeo a 6 decimales para absorber el error de punto flotante binario de operaciones
 * como `0.2 * 3` (da `0.6000000000000001`, no `0.6`) sin perder precisión real: las
 * cantidades de este dominio (gramos/unidades de receta) nunca necesitan más que 2-3
 * decimales, así que 6 es un margen amplio, no un recorte de precisión.
 */
function redondear(cantidad: number): number {
  return Math.round(cantidad * 1e6) / 1e6;
}

/**
 * Consumo de artículos de una línea de venta (spec E2 §4.4): componentes fijos del producto
 * + el consumo de cada grupo de modificadores elegido, todo escalado por la cantidad vendida.
 */
export function calcularConsumo(
  cantidadLinea: number,
  componentesFijos: readonly ComponenteFijo[],
  grupos: readonly GrupoConfig[],
): ConsumoLinea[] {
  const consumos: ConsumoLinea[] = componentesFijos.map((c) => ({
    articulo_id: c.articulo_id,
    cantidad: redondear(c.cantidad * cantidadLinea),
  }));

  for (const grupo of grupos) {
    if (grupo.modo_descuento === 'sin_descuento') continue;
    if (grupo.modo_descuento === 'por_opcion') {
      for (const op of grupo.opciones_elegidas) {
        consumos.push({ articulo_id: op.articulo_id, cantidad: redondear(op.cantidad * cantidadLinea) });
      }
      continue;
    }
    // reparto: cantidad_total dividida en partes iguales entre las opciones elegidas
    const n = grupo.opciones_elegidas.length;
    if (n === 0) continue;
    const porOpcion = grupo.cantidad_total / n;
    for (const op of grupo.opciones_elegidas) {
      consumos.push({ articulo_id: op.articulo_id, cantidad: redondear(porOpcion * cantidadLinea) });
    }
  }

  return consumos;
}

export type StockInfo = { stock: number; bloquea_sin_stock: boolean };
export type ValidacionStock = { articulo_id: string; ok: boolean; bloquea: boolean; stockResultante: number };

/** Validación de stock al vender (spec E2 §4.4, regla R2). */
export function validarStock(
  consumos: readonly ConsumoLinea[],
  stocks: ReadonlyMap<string, StockInfo>,
): ValidacionStock[] {
  return consumos.map((c) => {
    const info = stocks.get(c.articulo_id);
    const stockActual = info?.stock ?? 0;
    const bloqueaSinStock = info?.bloquea_sin_stock ?? true;
    const stockResultante = redondear(stockActual - c.cantidad) + 0; // + 0 normaliza -0
    const bloquea = bloqueaSinStock && stockResultante < 0;
    return { articulo_id: c.articulo_id, ok: !bloquea, bloquea, stockResultante };
  });
}
