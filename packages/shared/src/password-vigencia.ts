// Vigencia de la contraseña y validación del mail del usuario (ADR-136). TypeScript puro y
// browser-safe: lo usan el main (login, alta, cambio) y el renderer (días restantes, formularios).

/** La contraseña vence a los 30 días del último cambio (pedido de producto, para todos los roles). */
export const PASSWORD_VIGENCIA_DIAS = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

function msDesdeCambio(changedAt: Date | null | undefined, ahora: Date): number | null {
  if (!(changedAt instanceof Date)) return null;
  const t = changedAt.getTime();
  if (Number.isNaN(t)) return null;
  return ahora.getTime() - t;
}

/**
 * Venció si pasaron 30 días o más desde el último cambio. Sin fecha (o ilegible) cuenta como vencida:
 * ante la duda se pide cambiarla. Una fecha futura (reloj atrasado) no vence.
 */
export function passwordVencida(changedAt: Date | null | undefined, ahora: Date = new Date()): boolean {
  const transcurrido = msDesdeCambio(changedAt, ahora);
  if (transcurrido === null) return true;
  return transcurrido >= PASSWORD_VIGENCIA_DIAS * DIA_MS;
}

/** Días que quedan (redondeo hacia arriba), entre 0 y 30. 0 si venció o no hay fecha. */
export function diasRestantesPassword(changedAt: Date | null | undefined, ahora: Date = new Date()): number {
  const transcurrido = msDesdeCambio(changedAt, ahora);
  if (transcurrido === null) return 0;
  const restanteMs = PASSWORD_VIGENCIA_DIAS * DIA_MS - Math.max(0, transcurrido);
  return Math.max(0, Math.ceil(restanteMs / DIA_MS));
}

export function normalizarEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase();
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validación práctica de formato (no verifica que el buzón exista). */
export function emailValido(email: string | null | undefined): boolean {
  const e = normalizarEmail(email);
  return e.length > 0 && e.length <= 254 && FORMATO_EMAIL.test(e);
}
