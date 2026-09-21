// packages/shared/src/fecha.ts
//
// Utilidades de fecha de CALENDARIO en hora local.
//
// Los instantes se guardan en la BD como epoch (UTC) — eso no tiene ambigüedad y no se
// toca. La ambigüedad aparece al convertir entre un instante y un "día de calendario"
// (lo que el usuario elige en un <input type="date"> y lo que ve en pantalla). Esa
// conversión tiene que hacerse SIEMPRE en la zona local del negocio.
//
// El error a evitar es `new Date('2026-01-15')`: la spec obliga a parsear un string
// date-only como medianoche UTC, que en Buenos Aires (-3) es el 14/01 a las 21:00. Usar
// ese Date como límite de un rango corre el día entero. El complemento es
// `toISOString().slice(0, 10)`, que devuelve el día UTC y adelanta la fecha después de
// las 21:00 locales.
//
// Estas funciones trabajan siempre con los componentes locales del Date.

const RE_YMD = /^(\d{4})-(\d{2})-(\d{2})/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Componentes [año, mes 0-based, día] del valor recibido, leídos en hora local. */
function partesLocales(v: string | Date): [number, number, number] {
  if (v instanceof Date) return [v.getFullYear(), v.getMonth(), v.getDate()];
  const m = RE_YMD.exec(v);
  if (!m) throw new Error(`Fecha de calendario inválida: ${v}`);
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

/** Medianoche local (00:00:00.000) del día indicado. Acepta 'YYYY-MM-DD' o Date. */
export function inicioDelDia(v: string | Date): Date {
  const [y, m, d] = partesLocales(v);
  return new Date(y, m, d, 0, 0, 0, 0);
}

/** Último instante local (23:59:59.999) del día indicado. Acepta 'YYYY-MM-DD' o Date. */
export function finDelDia(v: string | Date): Date {
  const [y, m, d] = partesLocales(v);
  return new Date(y, m, d, 23, 59, 59, 999);
}

/** Formatea un Date como 'YYYY-MM-DD' con sus componentes locales (para <input type="date">). */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formatea un Date como 'YYYY-MM-DDTHH:mm' local (para <input type="datetime-local">). */
export function ymdHmLocal(d: Date): string {
  return `${ymdLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fecha de calendario de hoy en hora local, como 'YYYY-MM-DD'. */
export function hoyYmd(): string {
  return ymdLocal(new Date());
}
