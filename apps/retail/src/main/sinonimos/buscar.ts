import { and, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { normalizarTermino } from './normalizar';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-067 — ¿está encendida la expansión por sinónimos? (flag de build/config).
export function esSinonimosHabilitado(db: Db): boolean {
  const f = db.select({ valor: schema.parametros_sistema.valor })
    .from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'sinonimos_habilitado'))
    .get();
  return f?.valor === 'true';
}

// Dado un texto de búsqueda, devuelve los términos HERMANOS NORMALIZADOS (los otros del/los
// grupo(s) que contienen ese término), para hacer LIKE contra `producto.nombre_corto_norm`
// (match acento-insensible). Excluye el término tal cual lo tipeó el usuario. Vacío si no
// hay match exacto de término (la búsqueda normal por substring sigue funcionando aparte).
export function expandirTerminos(db: Db, texto: string): string[] {
  const norm = normalizarTermino(texto);
  if (!norm) return [];

  const matches = db.select({ grupo_id: schema.sinonimo.grupo_id })
    .from(schema.sinonimo)
    .where(and(eq(schema.sinonimo.termino_norm, norm), eq(schema.sinonimo.activo, true)))
    .all();
  if (matches.length === 0) return [];

  const grupoIds = [...new Set(matches.map(m => m.grupo_id))];
  const hermanos = db.select({
    termino_norm: schema.sinonimo.termino_norm,
    es_abreviatura: schema.sinonimo.es_abreviatura,
  })
    .from(schema.sinonimo)
    .where(and(inArray(schema.sinonimo.grupo_id, grupoIds), eq(schema.sinonimo.activo, true)))
    .all();

  const out = new Set<string>();
  for (const h of hermanos) {
    // Las abreviaturas son SOLO-ENTRADA: no se emiten como patrón de substring.
    if (h.es_abreviatura) continue;
    if (h.termino_norm !== norm) out.add(h.termino_norm);
  }
  return [...out];
}
