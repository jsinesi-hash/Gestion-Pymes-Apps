import { normalizar } from './texto.js';

// ADR-063 (Lote 3) — Matcher token-set para similitud de nombres (producto interno ↔
// producto de proveedor). Funciones PURAS y sin efectos: la construcción del índice
// invertido y el diccionario de sinónimos viven en el backend (usan la BD). El score es el
// coeficiente de Dice sobre conjuntos de tokens, previa canonización por sinónimos.

// Tokeniza un texto: normaliza (measure-aware, ver texto.ts) y parte por espacio.
export function tokenizar(s: string): string[] {
  const n = normalizar(s);
  return n.length ? n.split(' ') : [];
}

// Mapea cada token a su forma canónica (si hay diccionario) y devuelve el CONJUNTO de
// tokens canónicos (sin duplicados). El diccionario es token_norm → canónico_norm.
export function canonizarTokens(tokens: Iterable<string>, sinonimos?: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (!t) continue;
    out.add(sinonimos?.get(t) ?? t);
  }
  return out;
}

// Coeficiente de Dice entre dos conjuntos de tokens: 2·|A∩B| / (|A|+|B|). Rango [0,1].
export function coeficienteDice(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

// Similitud [0,1] entre dos nombres crudos, con canonización opcional por sinónimos.
export function similitudNombres(a: string, b: string, sinonimos?: ReadonlyMap<string, string>): number {
  return coeficienteDice(
    canonizarTokens(tokenizar(a), sinonimos),
    canonizarTokens(tokenizar(b), sinonimos),
  );
}
