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
