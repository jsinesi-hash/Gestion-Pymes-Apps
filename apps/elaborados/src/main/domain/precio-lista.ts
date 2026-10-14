/**
 * Precio de un producto de venta en una lista (ADR-104): el precio absoluto cargado en la lista
 * pisa a todo; si no hay, se aplica el ajuste % de la lista sobre el precio base. En centavos.
 * Los recargos premium de sabor NO pasan por acá: no varían por lista.
 */
export function precioParaLista(
  baseCentavos: number,
  absolutoCentavos: number | null,
  ajustePorcentual: number,
): number {
  if (absolutoCentavos != null) return absolutoCentavos;
  return Math.max(0, Math.round(baseCentavos * (1 + ajustePorcentual / 100)));
}
