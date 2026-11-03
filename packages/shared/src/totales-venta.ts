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
  /** En pesos, con ajuste de lista y descuento de línea ya aplicados. */
  precio_unitario: number;
  /** %, 0-100. Solo se valida el rango: el precio unitario ya lo incluye. */
  descuento_linea: number;
  alicuota_iva: number;
  /** En pesos. */
  subtotal: number;
};

export type TotalesVentaInput = {
  lineas: LineaTotalesVenta[];
  /** %, 0-100. */
  descuento_global: number;
  /** Todos en pesos. */
  subtotal: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
};

/** El IVA lo calcula el renderer en pesos con float sin redondear por línea: se tolera 1 centavo. */
const TOLERANCIA_IVA_CENTAVOS = 1.01;

const aCentavos = (pesos: number): number => Math.round(pesos * 100);
const finito = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const enPorcentaje = (n: unknown): boolean => finito(n) && n >= 0 && n <= 100;

/**
 * Lanza `Error` con uno de estos códigos (el catálogo del renderer los traduce):
 * `DESCUENTO_INVALIDO`, `CANTIDAD_INVALIDA`, `PRECIO_INVALIDO` o `TOTALES_INCONSISTENTES`.
 */
export function verificarTotalesVenta(input: TotalesVentaInput): void {
  if (!enPorcentaje(input.descuento_global)) throw new Error('DESCUENTO_INVALIDO');

  let subtotalCentavos = 0;
  let ivaPesos = 0;

  for (const l of input.lineas) {
    if (!finito(l.cantidad) || l.cantidad <= 0) throw new Error('CANTIDAD_INVALIDA');
    if (!finito(l.precio_unitario) || l.precio_unitario < 0) throw new Error('PRECIO_INVALIDO');
    if (!enPorcentaje(l.descuento_linea)) throw new Error('DESCUENTO_INVALIDO');
    if (!finito(l.alicuota_iva) || l.alicuota_iva < 0) throw new Error('TOTALES_INCONSISTENTES');
    if (!finito(l.subtotal)) throw new Error('TOTALES_INCONSISTENTES');

    const subtotalLinea = Math.round(aCentavos(l.precio_unitario) * l.cantidad);
    if (subtotalLinea !== aCentavos(l.subtotal)) throw new Error('TOTALES_INCONSISTENTES');

    subtotalCentavos += subtotalLinea;
    ivaPesos += (subtotalLinea / 100) * l.alicuota_iva / (100 + l.alicuota_iva);
  }

  for (const n of [input.subtotal, input.importe_iva, input.total, input.ajuste_redondeo]) {
    if (!finito(n)) throw new Error('TOTALES_INCONSISTENTES');
  }

  if (aCentavos(input.subtotal) !== subtotalCentavos) throw new Error('TOTALES_INCONSISTENTES');

  // Misma expresión que `resolverPrecio` para el descuento global.
  const conDescuentoGlobal = Math.round(subtotalCentavos * (1 - input.descuento_global / 100));
  const redondeo = redondearPeso(conDescuentoGlobal);
  if (aCentavos(input.total) !== redondeo.totalCentavos) throw new Error('TOTALES_INCONSISTENTES');
  if (aCentavos(input.ajuste_redondeo) !== redondeo.ajusteRedondeoCentavos) throw new Error('TOTALES_INCONSISTENTES');

  if (Math.abs(ivaPesos * 100 - input.importe_iva * 100) > TOLERANCIA_IVA_CENTAVOS) {
    throw new Error('TOTALES_INCONSISTENTES');
  }
}
