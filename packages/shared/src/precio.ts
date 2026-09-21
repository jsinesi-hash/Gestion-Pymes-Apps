/**
 * Motor de resolución de precio para Ferretería.
 *
 * Representación monetaria: CENTAVOS (enteros, sin float).
 * precioListaCentavos es IVA incluido — discriminación de IVA diferida a R2.
 */

export type LineaPrecioInput = {
  /** precio_venta_lista × 100, entero. IVA incluido. */
  precioListaCentavos: number;
  /** Ajuste efectivo de la lista. Usar ajusteEfectivo(general, override) antes de llamar. */
  ajustePct: number;
  /** Descuento de línea en %. 0 si no aplica. */
  descuentoLineaPct: number;
  /** Cantidad. Puede ser decimal si el producto permite fracción. */
  cantidad: number;
};

export type VentaPrecioInput = {
  lineas: LineaPrecioInput[];
  /** Descuento global sobre el subtotal en %. 0 si no aplica. */
  descuentoGlobalPct: number;
};

export type LineaPrecioResult = {
  precioUnitarioCentavos: number;
  subtotalCentavos: number;
};

export type VentaPrecioResult = {
  lineas: LineaPrecioResult[];
  subtotalCentavos: number;
  descuentoGlobalCentavos: number;
  /** Total exacto en centavos, sin redondear a peso entero. Usar redondearPeso() si necesitás. */
  totalCentavos: number;
};

export type RedondeoResult = {
  /** Total redondeado al peso entero más cercano (múltiplo de 100 centavos). */
  totalCentavos: number;
  /** Diferencia entre total redondeado y exacto. Siempre en [-50, +50]. */
  ajusteRedondeoCentavos: number;
};

/**
 * Devuelve el ajuste porcentual efectivo para una línea.
 * El override de producto reemplaza (no suma) al ajuste general de la lista.
 */
export function ajusteEfectivo(ajusteGeneral: number, ajusteOverride: number | null): number {
  return ajusteOverride ?? ajusteGeneral;
}

/**
 * Resuelve el precio de una venta:
 * base → ajuste de lista → descuento de línea → descuento global.
 * Devuelve centavos exactos. Para redondear al peso usá redondearPeso().
 */
export function resolverPrecio(input: VentaPrecioInput): VentaPrecioResult {
  const lineas: LineaPrecioResult[] = input.lineas.map((l) => {
    const precioAjustado = Math.round(l.precioListaCentavos * (1 + l.ajustePct / 100));
    const precioFinal = Math.round(precioAjustado * (1 - l.descuentoLineaPct / 100));
    const subtotalCentavos = Math.round(precioFinal * l.cantidad);
    return { precioUnitarioCentavos: precioFinal, subtotalCentavos };
  });

  const subtotalCentavos = lineas.reduce((s, l) => s + l.subtotalCentavos, 0);
  const conDescGlobal = Math.round(subtotalCentavos * (1 - input.descuentoGlobalPct / 100));
  const descuentoGlobalCentavos = subtotalCentavos - conDescGlobal;

  return { lineas, subtotalCentavos, descuentoGlobalCentavos, totalCentavos: conDescGlobal };
}

/**
 * Redondea un total en centavos al peso entero más cercano.
 * Invariante: ajusteRedondeoCentavos ∈ [-50, +50].
 */
export function redondearPeso(centavos: number): RedondeoResult {
  const totalCentavos = Math.round(centavos / 100) * 100;
  const ajusteRedondeoCentavos = totalCentavos - centavos;
  return { totalCentavos, ajusteRedondeoCentavos };
}

/** Modos de redondeo comercial del precio de lista (ADR-049 §3). */
export type RedondeoComercialModo = 'ninguno' | 'terminacion_90' | 'terminacion_99' | 'multiplo';

/**
 * Redondeo comercial del precio de lista, aplicado **después del margen** (ADR-049 §3).
 * Es independiente de `redondearPeso` (que sigue aplicándose al total de la venta, ADR-010).
 *
 * - `ninguno`: sin cambios.
 * - `terminacion_90` / `terminacion_99`: al valor más cercano terminado en ,90 / ,99.
 * - `multiplo`: al múltiplo de `valor` centavos más cercano (100 = $1, 500 = $5).
 *   Si `valor` no es un entero positivo, devuelve el precio sin tocar.
 */
export function redondearComercial(
  centavos: number,
  modo: RedondeoComercialModo,
  valor?: number | null,
): number {
  switch (modo) {
    case 'terminacion_90':
      return Math.max(90, Math.round((centavos - 90) / 100) * 100 + 90);
    case 'terminacion_99':
      return Math.max(99, Math.round((centavos - 99) / 100) * 100 + 99);
    case 'multiplo':
      if (!valor || valor <= 0) return centavos;
      return Math.round(centavos / valor) * valor;
    case 'ninguno':
    default:
      return centavos;
  }
}
