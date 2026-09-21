import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { tokenizar, canonizarTokens, coeficienteDice } from '@ferreteria/shared';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-063 (Lote 3) — Matcher por similitud de nombre. Reutiliza el diccionario de sinónimos
// de ADR-067 (tabla `sinonimo`) para canonizar tokens en tiempo de comparación (no se
// expande dentro de `nombre_corto_norm`). El scoring token-set (Dice) vive en shared; acá
// se arma el diccionario y el índice invertido token→productos UNA vez por corrida.

// Diccionario token_norm → canónico_norm, derivado de los grupos activos de `sinonimo`.
// Incluye abreviaturas (útiles como disparador también en el matching de nombres).
export function construirMapaSinonimos(db: Db): Map<string, string> {
  const rows = db.select({
    grupo_id: schema.sinonimo.grupo_id,
    termino_norm: schema.sinonimo.termino_norm,
    es_canonico: schema.sinonimo.es_canonico,
  }).from(schema.sinonimo).where(eq(schema.sinonimo.activo, true)).all();

  const canonicoPorGrupo = new Map<string, string>();
  for (const r of rows) if (r.es_canonico) canonicoPorGrupo.set(r.grupo_id, r.termino_norm);

  const mapa = new Map<string, string>();
  for (const r of rows) {
    mapa.set(r.termino_norm, canonicoPorGrupo.get(r.grupo_id) ?? r.termino_norm);
  }
  return mapa;
}

export type CandidatoSimilitud = {
  producto_id: string;
  sku: string;
  nombre_corto: string;
  score: number; // coeficiente de Dice [0,1]
};

export type MatcherOpts = { limite?: number; piso?: number };

export interface ProductoMatcher {
  sugerir(nombre: string, opts?: MatcherOpts): CandidatoSimilitud[];
}

// Arma el diccionario + el índice invertido una sola vez (por corrida de importación).
// `sugerir` se llama por cada fila del proveedor.
//
// El texto del producto se toma de `nombre_corto` Y `nombre_largo` (descripción), normalizado
// EN VIVO con `tokenizar` (no desde la columna `nombre_corto_norm`, que puede quedar
// desactualizada si el nombre se editó por una vía que no la recomputó). El score de un
// candidato es el MEJOR de los dos campos (best-field): así, matchear por la descripción da
// buen puntaje sin que un nombre largo diluya el match del nombre corto, ni viceversa.
export function crearMatcher(db: Db): ProductoMatcher {
  const sinonimos = construirMapaSinonimos(db);

  const productos = db.select({
    id: schema.producto.id,
    sku: schema.producto.sku,
    nombre_corto: schema.producto.nombre_corto,
    nombre_largo: schema.producto.nombre_largo,
  }).from(schema.producto).where(eq(schema.producto.activo, true)).all();

  const items = productos.map(p => ({
    id: p.id,
    sku: p.sku,
    nombre_corto: p.nombre_corto,
    setCorto: canonizarTokens(tokenizar(p.nombre_corto), sinonimos),
    setLargo: p.nombre_largo ? canonizarTokens(tokenizar(p.nombre_largo), sinonimos) : new Set<string>(),
  }));

  // Índice invertido: token canónico → índices de productos que lo contienen (unión de
  // ambos campos, para que el producto sea candidato si comparte ≥1 token con cualquiera).
  const invertido = new Map<string, number[]>();
  items.forEach((it, i) => {
    const tokensProducto = new Set<string>([...it.setCorto, ...it.setLargo]);
    for (const t of tokensProducto) {
      const arr = invertido.get(t);
      if (arr) arr.push(i); else invertido.set(t, [i]);
    }
  });

  return {
    sugerir(nombre: string, opts: MatcherOpts = {}): CandidatoSimilitud[] {
      const limite = opts.limite ?? 5;
      const piso = opts.piso ?? 0.34;
      const q = canonizarTokens(tokenizar(nombre), sinonimos);
      if (q.size === 0) return [];

      // Sólo se puntúan productos que comparten ≥1 token con la consulta (por cualquier campo).
      const candidatos = new Set<number>();
      for (const t of q) for (const i of invertido.get(t) ?? []) candidatos.add(i);

      const scored: CandidatoSimilitud[] = [];
      for (const i of candidatos) {
        const score = Math.max(
          coeficienteDice(q, items[i].setCorto),
          coeficienteDice(q, items[i].setLargo),
        );
        if (score >= piso) {
          scored.push({ producto_id: items[i].id, sku: items[i].sku, nombre_corto: items[i].nombre_corto, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limite);
    },
  };
}
