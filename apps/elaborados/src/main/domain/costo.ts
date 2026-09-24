/**
 * Costo promedio ponderado de artículos (spec E2 §4.4/§5). Con stock previo ≤ 0 no hay base
 * positiva para ponderar: el costo nuevo pasa a ser directamente el costo de la entrada.
 */
export function costoPromedioEntrada(
  stockPrevio: number,
  costoPromedioPrevioCentavos: number,
  cantidadEntra: number,
  costoEntraCentavos: number,
): number {
  if (stockPrevio <= 0) return costoEntraCentavos;
  const valorPrevio = stockPrevio * costoPromedioPrevioCentavos;
  const valorEntra = cantidadEntra * costoEntraCentavos;
  return Math.round((valorPrevio + valorEntra) / (stockPrevio + cantidadEntra));
}

export type ConsumoConCosto = { cantidad: number; costoPromedioCentavos: number };

/** Costo unitario del lote producido: promedio ponderado de los insumos consumidos. */
export function costoDeLote(consumos: readonly ConsumoConCosto[], cantidadProducida: number): number {
  if (cantidadProducida <= 0) throw new Error('CANTIDAD_PRODUCIDA_INVALIDA');
  const total = consumos.reduce((acc, c) => acc + c.cantidad * c.costoPromedioCentavos, 0);
  return Math.round(total / cantidadProducida);
}
