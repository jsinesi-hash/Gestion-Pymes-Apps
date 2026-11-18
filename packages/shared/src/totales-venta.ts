/**
 * Verificación de coherencia aritmética de los totales de una venta (Retail).
 *
 * Revisión 2026-10-20 (P1): el renderer calcula subtotal, IVA, total y ajuste de redondeo y el
 * main los recibía sin recalcular (solo se re-verificaba el precio unitario contra la lista).
 * Acá se rehace la cuenta en centavos con la MISMA fórmula del POS (`resolverPrecio` +
 * `redondearPeso`, ver usePosSession.confirmar). No consulta listas de precio: el precio unitario
 * ya llega con ajuste y descuento de línea aplicados, y su validez contra la lista es otro control.
 *
 * Funciones puras, sin Electron ni Node (shared es browser-safe).
 */
import { redondearPeso } from './precio.js';

export type LineaTotalesVenta = {
  cantidad: number;
  /** En centavos (ADR-157), con ajuste de lista y descuento de línea ya aplicados. */
  precio_unitario_centavos: number;
  /** %, 0-100. Solo se valida el rango: el precio unitario ya lo incluye. */
  descuento_linea: number;
  alicuota_iva: number;
  /** En centavos. */
  subtotal_centavos: number;
};

export type TotalesVentaInput = {
  lineas: LineaTotalesVenta[];
  /** %, 0-100. */
  descuento_global: number;
  /** Todos en centavos (ADR-157). */
  subtotal_centavos: number;
  importe_iva_centavos: number;
  total_centavos: number;
  ajuste_redondeo_centavos: number;
};

/** El IVA lo discrimina el renderer sobre el total con decimales: se tolera 1 centavo. */
const TOLERANCIA_IVA_CENTAVOS = 1.01;

const finito = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const entero = (n: unknown): n is number => finito(n) && Number.isInteger(n);
const enPorcentaje = (n: unknown): boolean => finito(n) && n >= 0 && n <= 100;

/**
 * Lanza `Error` con uno de estos códigos (el catálogo del renderer los traduce):
 * `DESCUENTO_INVALIDO`, `CANTIDAD_INVALIDA`, `PRECIO_INVALIDO` o `TOTALES_INCONSISTENTES`.
 * ADR-157: todos los importes llegan en centavos enteros; se comparan exactos (salvo el IVA).
 */
export function verificarTotalesVenta(input: TotalesVentaInput): void {
  if (!enPorcentaje(input.descuento_global)) throw new Error('DESCUENTO_INVALIDO');

  let subtotalCentavos = 0;
  let ivaCentavos = 0;

  for (const l of input.lineas) {
    if (!finito(l.cantidad) || l.cantidad <= 0) throw new Error('CANTIDAD_INVALIDA');
    if (!entero(l.precio_unitario_centavos) || l.precio_unitario_centavos < 0) throw new Error('PRECIO_INVALIDO');
    if (!enPorcentaje(l.descuento_linea)) throw new Error('DESCUENTO_INVALIDO');
    if (!finito(l.alicuota_iva) || l.alicuota_iva < 0) throw new Error('TOTALES_INCONSISTENTES');
    if (!entero(l.subtotal_centavos)) throw new Error('TOTALES_INCONSISTENTES');

    const subtotalLinea = Math.round(l.precio_unitario_centavos * l.cantidad);
    if (subtotalLinea !== l.subtotal_centavos) throw new Error('TOTALES_INCONSISTENTES');

    subtotalCentavos += subtotalLinea;
    ivaCentavos += subtotalLinea * l.alicuota_iva / (100 + l.alicuota_iva);
  }

  for (const n of [input.subtotal_centavos, input.importe_iva_centavos, input.total_centavos, input.ajuste_redondeo_centavos]) {
    if (!entero(n)) throw new Error('TOTALES_INCONSISTENTES');
  }

  if (input.subtotal_centavos !== subtotalCentavos) throw new Error('TOTALES_INCONSISTENTES');

  // Misma expresión que `resolverPrecio` para el descuento global.
  const conDescuentoGlobal = Math.round(subtotalCentavos * (1 - input.descuento_global / 100));
  const redondeo = redondearPeso(conDescuentoGlobal);
  if (input.total_centavos !== redondeo.totalCentavos) throw new Error('TOTALES_INCONSISTENTES');
  if (input.ajuste_redondeo_centavos !== redondeo.ajusteRedondeoCentavos) throw new Error('TOTALES_INCONSISTENTES');

  if (Math.abs(ivaCentavos - input.importe_iva_centavos) > TOLERANCIA_IVA_CENTAVOS) {
    throw new Error('TOTALES_INCONSISTENTES');
  }
}
