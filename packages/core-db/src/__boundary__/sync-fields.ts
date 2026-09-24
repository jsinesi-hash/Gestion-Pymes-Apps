// packages/core-db/src/__boundary__/sync-fields.ts
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';

export const CAMPOS_SYNC = ['version', 'origin_id', 'sync_state', 'updated_at'] as const;

/**
 * B2: devuelve los nombres de tabla del esquema que NO cumplen el patrón transversal
 * (id texto + campos de sync), salvo las `excepciones` explícitas. Puro: no toca disco ni
 * abre una conexión — recorre el objeto de esquema compuesto que cada app le pasa a Drizzle.
 */
export function verificarCamposSync(schema: Record<string, unknown>, excepciones: readonly string[]): string[] {
  const malas: string[] = [];
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    if (excepciones.includes(cfg.name)) continue;
    const cols = new Map(cfg.columns.map((c) => [c.name, c]));
    const id = cols.get('id');
    const ok = id?.getSQLType() === 'text' && CAMPOS_SYNC.every((c) => cols.has(c));
    if (!ok) malas.push(cfg.name);
  }
  return malas.sort();
}
