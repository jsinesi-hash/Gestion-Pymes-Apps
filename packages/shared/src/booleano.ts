// Parser booleano canónico para importaciones (ADR-065). Único punto de verdad del
// vocabulario booleano: reemplaza las tres formas divergentes del importador
// (`activo`, `permite_fraccion`, `habilita_cuenta_corriente`). Función pura, sin BD.
export type BooleanoParse = { ok: true; value: boolean } | { ok: false };

const TRUE_TOKENS = new Set(['si', 'sí', 's', 'true', 'verdadero', 'v', '1', 'x']);
const FALSE_TOKENS = new Set(['no', 'n', 'false', 'falso', 'f', '0']);

/**
 * - Celda vacía => default provisto por el llamador (default por campo).
 * - Token reconocido => su valor booleano.
 * - Token NO reconocido => { ok: false } (el llamador lo convierte en error de fila;
 *   nunca un default silencioso — ADR-065 §Rechazado).
 */
export function parseBooleanoImport(raw: string, opts: { default: boolean }): BooleanoParse {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === '') return { ok: true, value: opts.default };
  if (TRUE_TOKENS.has(t)) return { ok: true, value: true };
  if (FALSE_TOKENS.has(t)) return { ok: true, value: false };
  return { ok: false };
}
