// ADR-082 (SEC-2): validación de payloads en el borde de los handlers de escritura.
// Primitivas puras: lanzan ValidationError(field, detail) o devuelven el valor tipado.
// El mensaje sigue el contrato "VALIDATION:<campo>:<detalle>" que el renderer traduce.

export class ValidationError extends Error {
  constructor(public readonly field: string, public readonly detail: string) {
    super(`VALIDATION:${field}:${detail}`);
    this.name = 'ValidationError';
  }
}
const fail = (field: string, detail: string): never => { throw new ValidationError(field, detail); };

export function str(v: unknown, field: string, o: { min?: number; max?: number } = {}): string {
  if (typeof v !== 'string') return fail(field, 'TIPO');
  const s = v.trim();
  if (s.length === 0) return fail(field, 'REQUERIDO');
  if (o.min != null && s.length < o.min) return fail(field, `MIN:${o.min}`);
  if (o.max != null && s.length > o.max) return fail(field, `MAX:${o.max}`);
  return s;
}
export function optStr(v: unknown, field: string, max?: number): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== 'string') return fail(field, 'TIPO');
  const s = v.trim();
  if (s.length === 0) return undefined;
  if (max != null && s.length > max) return fail(field, `MAX:${max}`);
  return s;
}
export function id(v: unknown, field: string): string {
  if (typeof v !== 'string') return fail(field, 'TIPO');
  const s = v.trim();
  if (s.length === 0) return fail(field, 'REQUERIDO');
  return s;
}
export function optId(v: unknown, field: string): string | undefined {
  if (v == null) return undefined;
  return id(v, field);
}
export function num(v: unknown, field: string, o: { min?: number; max?: number } = {}): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fail(field, 'TIPO');
  if (o.min != null && v < o.min) return fail(field, `MIN:${o.min}`);
  if (o.max != null && v > o.max) return fail(field, `MAX:${o.max}`);
  return v;
}
export function int(v: unknown, field: string, o: { min?: number; max?: number } = {}): number {
  const n = num(v, field, o);
  if (!Number.isInteger(n)) return fail(field, 'NO_ENTERO');
  return n;
}
export function centavos(v: unknown, field: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fail(field, 'TIPO');
  if (v < 0) return fail(field, 'NEGATIVO');
  if (!Number.isInteger(v)) return fail(field, 'NO_ENTERO');
  return v;
}
export function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') return fail(field, 'TIPO');
  return v;
}
export function oneOf<T extends string>(v: unknown, field: string, vals: readonly T[]): T {
  if (typeof v !== 'string' || !vals.includes(v as T)) return fail(field, 'ENUM');
  return v as T;
}
export function arr<T>(v: unknown, field: string, each: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(v)) return fail(field, 'TIPO');
  return v.map((x, i) => each(x, i));
}
