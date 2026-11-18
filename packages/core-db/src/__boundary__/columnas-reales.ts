import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';

/**
 * Baranda de ADR-157 (PR-C4): el dinero va en centavos enteros. Cada columna REAL del esquema
 * compuesto tiene que estar declarada por la app como `tabla.columna` (cantidades, stock, factores,
 * porcentajes); una REAL nueva que nadie declaró es sospechosa de ser dinero en pesos. También
 * marca las declaraciones que ya no son una columna REAL, para que la lista no se pudra.
 */
export function columnasRealesNoDeclaradas(schema: Record<string, unknown>, declaradas: readonly string[]): string[] {
  const reales = new Set<string>();
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    for (const c of cfg.columns) if (c.getSQLType() === 'real') reales.add(`${cfg.name}.${c.name}`);
  }
  const permitidas = new Set(declaradas);
  const problemas: string[] = [];
  for (const r of reales) if (!permitidas.has(r)) problemas.push(`real_no_declarada:${r}`);
  for (const d of permitidas) if (!reales.has(d)) problemas.push(`declarada_sin_real:${d}`);
  return problemas.sort();
}
