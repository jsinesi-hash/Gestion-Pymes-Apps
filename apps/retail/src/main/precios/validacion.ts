/**
 * Motor de validación de filas de un lote de precios (ADR-049 §5).
 * Lógica pura (sin DB): decide el estado de validación de cada fila propuesta.
 */

export type FilaValidacionInput = {
  costoNetoCentavos: number | null;
  precioPropuestoCentavos: number;
  precioAnteriorCentavos: number | null;
  tienePreferido: boolean;
  proveedorActivo: boolean;
  productoActivo: boolean;
  /** Bounds de markup de la regla (misma convención markup). */
  margenMinPct: number | null;
  margenMaxPct: number | null;
};

export type Umbrales = {
  variacionMaximaPct: number;
  margenMinimoPct: number;
};

export type ResultadoValidacion = {
  estado: 'ok' | 'advertencia' | 'error';
  motivo: string | null;
};

const ok: ResultadoValidacion = { estado: 'ok', motivo: null };
const error = (motivo: string): ResultadoValidacion => ({ estado: 'error', motivo });
const advertencia = (motivo: string): ResultadoValidacion => ({ estado: 'advertencia', motivo });

export function validarFila(f: FilaValidacionInput, u: Umbrales): ResultadoValidacion {
  // Errores (bloquean la aprobación mientras no se excluyan)
  if (!f.productoActivo) return error('Producto inactivo');
  if (!f.tienePreferido || f.costoNetoCentavos == null) return error('Sin proveedor preferido / sin costo');
  if (!f.proveedorActivo) return error('Proveedor inactivo');
  if (f.precioPropuestoCentavos < f.costoNetoCentavos) return error('Precio bajo el costo neto');

  const markupPct = f.costoNetoCentavos > 0
    ? (f.precioPropuestoCentavos / f.costoNetoCentavos - 1) * 100
    : 0;

  if (markupPct < u.margenMinimoPct) return error('Margen bajo el mínimo');
  if (f.margenMinPct != null && markupPct < f.margenMinPct) return error('Margen bajo el mínimo de la regla');
  if (f.margenMaxPct != null && markupPct > f.margenMaxPct) return error('Margen sobre el máximo de la regla');

  // Advertencia: variación fuerte respecto del precio anterior
  if (f.precioAnteriorCentavos != null && f.precioAnteriorCentavos > 0) {
    const variacionPct = Math.abs(
      (f.precioPropuestoCentavos - f.precioAnteriorCentavos) / f.precioAnteriorCentavos * 100,
    );
    if (variacionPct > u.variacionMaximaPct) return advertencia('Variación mayor al umbral');
  }

  return ok;
}
