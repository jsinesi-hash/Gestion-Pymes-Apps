/**
 * Motor de costo neto para Ferretería (ADR-049 §1).
 *
 * Deriva el **costo neto** de un producto-proveedor a partir del costo bruto y los
 * componentes comerciales (bonificación, flete, otros costos y costo financiero).
 *
 * Los componentes viven como **default por proveedor** con **override nullable por
 * producto**. Resolución de cada componente: `override_producto ?? default_proveedor ?? 0`.
 * Con todo en su default 0, **costo neto = costo bruto** y nada cambia respecto de hoy.
 *
 * Representación monetaria: CENTAVOS (enteros, sin float). Los porcentajes son `number`.
 * Aritmética pura, sin efectos — testeable sin Electron y reutilizable desde el renderer
 * para previews (mismo criterio que `precio.ts`).
 */

/** Overrides comerciales a nivel producto-proveedor. `null` = hereda del proveedor. */
export type OverrideComercialProducto = {
  bonificacionPct: number | null;
  costoFinancieroPct: number | null;
  fletePct: number | null;
  /** Flete absoluto en centavos (caso peso/volumen). Si no es null, pisa a `fletePct`. */
  fleteCentavos: number | null;
  otrosCostosCentavos: number | null;
};

/** Defaults comerciales a nivel proveedor. Todos con default 0. */
export type DefaultsComercialProveedor = {
  bonificacionPctDefault: number;
  costoFinancieroPctDefault: number;
  fletePctDefault: number;
};

/** Componentes comerciales ya resueltos (sin nulos, salvo el flete absoluto opcional). */
export type ComponentesComerciales = {
  bonificacionPct: number;
  costoFinancieroPct: number;
  fletePct: number;
  /** Flete absoluto en centavos; `null` = usar `fletePct`. */
  fleteCentavos: number | null;
  otrosCostosCentavos: number;
};

/** Costo neto con su desglose aditivo. Todos los importes en centavos enteros. */
export type CostoNetoResult = {
  brutoCentavos: number;
  /** Descuento por bonificación (lo que se resta del bruto). */
  bonificacionCentavos: number;
  /** Flete resuelto: absoluto si se cargó, si no el prorrateo del `fletePct` sobre el bruto. */
  fleteCentavos: number;
  /** Otros costos absolutos. */
  otrosCentavos: number;
  /** Recargo por costo financiero (lo que suma el % financiero sobre el subtotal). */
  costoFinancieroCentavos: number;
  /** Costo neto final = bruto − bonificación + flete + otros + costo financiero. */
  netoCentavos: number;
};

/**
 * Resuelve cada componente comercial con la regla `override ?? default ?? 0`.
 * El flete absoluto (`fleteCentavos`) sólo existe a nivel producto; sin override es `null`.
 */
export function resolverComponentesComerciales(
  override: OverrideComercialProducto,
  defaults: DefaultsComercialProveedor,
): ComponentesComerciales {
  return {
    bonificacionPct: override.bonificacionPct ?? defaults.bonificacionPctDefault ?? 0,
    costoFinancieroPct: override.costoFinancieroPct ?? defaults.costoFinancieroPctDefault ?? 0,
    fletePct: override.fletePct ?? defaults.fletePctDefault ?? 0,
    fleteCentavos: override.fleteCentavos ?? null,
    otrosCostosCentavos: override.otrosCostosCentavos ?? 0,
  };
}

/**
 * Calcula el costo neto a partir del costo bruto y los componentes ya resueltos.
 *
 * Fórmula (ADR-049 §1):
 *   flete     = fleteCentavos ?? round(bruto × fletePct / 100)          // absoluto pisa al %
 *   costoNeto = round( (bruto × (1 − bonif/100) + flete + otros) × (1 + costFin/100) )
 *
 * Se redondea en cada componente para que el desglose sea **aditivo y exacto**
 * (bruto − bonif + flete + otros + costFin = neto), lo que la UI necesita para mostrar
 * el costo neto desglosado sin descuadres de 1 centavo. Coincide con la fórmula del ADR
 * para porcentajes enteros sobre importes redondos (el caso de uso real).
 */
export function calcularCostoNeto(
  brutoCentavos: number,
  comp: ComponentesComerciales,
): CostoNetoResult {
  const bonificacionCentavos = Math.round((brutoCentavos * comp.bonificacionPct) / 100);
  const baseNeta = brutoCentavos - bonificacionCentavos;
  const fleteCentavos =
    comp.fleteCentavos ?? Math.round((brutoCentavos * comp.fletePct) / 100);
  const otrosCentavos = comp.otrosCostosCentavos;
  const subtotal = baseNeta + fleteCentavos + otrosCentavos;
  const costoFinancieroCentavos = Math.round((subtotal * comp.costoFinancieroPct) / 100);
  const netoCentavos = subtotal + costoFinancieroCentavos;

  return {
    brutoCentavos,
    bonificacionCentavos,
    fleteCentavos,
    otrosCentavos,
    costoFinancieroCentavos,
    netoCentavos,
  };
}

/** Conveniencia: resuelve los componentes y calcula el costo neto en un paso. */
export function costoNeto(
  brutoCentavos: number,
  override: OverrideComercialProducto,
  defaults: DefaultsComercialProveedor,
): CostoNetoResult {
  return calcularCostoNeto(brutoCentavos, resolverComponentesComerciales(override, defaults));
}
