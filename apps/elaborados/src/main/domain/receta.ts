export type ItemReceta = { articulo_id: string; cantidad: number };
export type ConsumoEscalado = { articulo_id: string; cantidad: number };

/** Escala los ítems de una receta según la cantidad producida real vs. el rinde de la receta. */
export function escalarReceta(
  items: readonly ItemReceta[],
  cantidadProducida: number,
  rindeCantidad: number,
): ConsumoEscalado[] {
  if (rindeCantidad <= 0) throw new Error('RINDE_INVALIDO');
  return items.map((item) => ({
    articulo_id: item.articulo_id,
    cantidad: (item.cantidad * cantidadProducida) / rindeCantidad,
  }));
}
