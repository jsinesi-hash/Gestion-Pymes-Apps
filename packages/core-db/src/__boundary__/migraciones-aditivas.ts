// packages/core-db/src/__boundary__/migraciones-aditivas.ts
// Convivencia de versiones (F3 PR6, análisis §3.9, ADR-042 y ADR-150 §8). Con varias cajas, el hub se
// actualiza primero y acepta las cajas de la versión anterior hasta que se actualicen. Eso funciona solo si
// cada migración es aditiva: una caja vieja sube filas sin las columnas nuevas (el hub las completa con su
// valor por defecto o null) y no conoce tablas que se renombraron ni columnas que se borraron.
// Esta baranda revisa el SQL de las migraciones posteriores al corte de cada app.

/**
 * Problemas de convivencia en el SQL de una migración (vacío = aditiva):
 * - `columna_obligatoria_sin_default:<tabla>.<columna>`: `ADD` de una columna NOT NULL sin DEFAULT (una caja
 *   vieja no la manda y el hub no puede guardar la fila);
 * - `columna_borrada:<tabla>.<columna>` y `columna_renombrada:<tabla>.<columna>`;
 * - `tabla_renombrada:<tabla>` (incluye el patrón de reconstruir una tabla: crear `__new_x` y renombrarla).
 */
export function problemasDeConvivencia(sql: string): string[] {
  const out: string[] = [];
  // Sin comentarios de línea: un `--` puede mencionar un DROP que no se ejecuta.
  const limpio = sql.split(/\r?\n/).map((l) => l.replace(/--.*$/, '')).join('\n');
  const nombre = (s: string) => s.replace(/[`"[\]]/g, '');
  for (const sentencia of limpio.split(/;|-->\s*statement-breakpoint/)) {
    const s = sentencia.replace(/\s+/g, ' ').trim();
    const alter = /^ALTER TABLE (\S+) (.*)$/i.exec(s);
    if (!alter) continue;
    const tabla = nombre(alter[1]!);
    const resto = alter[2]!;
    let m: RegExpExecArray | null;
    if ((m = /^ADD (?:COLUMN )?(\S+) (.*)$/i.exec(resto))) {
      const def = m[2]!;
      if (/\bNOT NULL\b/i.test(def) && !/\bDEFAULT\b/i.test(def)) out.push(`columna_obligatoria_sin_default:${tabla}.${nombre(m[1]!)}`);
    } else if ((m = /^DROP (?:COLUMN )?(\S+)/i.exec(resto))) {
      out.push(`columna_borrada:${tabla}.${nombre(m[1]!)}`);
    } else if ((m = /^RENAME COLUMN (\S+)/i.exec(resto))) {
      out.push(`columna_renombrada:${tabla}.${nombre(m[1]!)}`);
    } else if (/^RENAME TO /i.test(resto)) {
      out.push(`tabla_renombrada:${tabla}`);
    }
  }
  return out;
}
