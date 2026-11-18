export type ConsumoConCosto = { cantidad: number; costoPromedioCentavos: number };

/** Costo unitario del lote producido: promedio ponderado de los insumos consumidos. */
export function costoDeLote(consumos: readonly ConsumoConCosto[], cantidadProducida: number): number {
  if (cantidadProducida <= 0) throw new Error('CANTIDAD_PRODUCIDA_INVALIDA');
  const total = consumos.reduce((acc, c) => acc + c.cantidad * c.costoPromedioCentavos, 0);
  return Math.round(total / cantidadProducida);
}
