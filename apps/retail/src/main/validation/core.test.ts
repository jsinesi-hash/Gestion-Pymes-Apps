import { describe, it, expect } from 'vitest';
import { ValidationError, str, optStr, id, optId, int, centavos, num, bool, oneOf, arr } from '@core/main';

describe('validation/core (ADR-082)', () => {
  it('str: requerido, trim y máximo', () => {
    expect(str('  hola ', 'nombre')).toBe('hola');
    expect(() => str('', 'nombre')).toThrow(/VALIDATION:nombre:REQUERIDO/);
    expect(() => str(5, 'nombre')).toThrow(/VALIDATION:nombre:TIPO/);
    expect(() => str('abc', 'nombre', { max: 2 })).toThrow(/VALIDATION:nombre:MAX:2/);
    expect(() => str('a', 'nombre', { min: 2 })).toThrow(/VALIDATION:nombre:MIN:2/);
  });
  it('optStr: undefined pasa, string se valida', () => {
    expect(optStr(undefined, 'obs')).toBeUndefined();
    expect(optStr('  ', 'obs')).toBeUndefined();
    expect(optStr('x', 'obs')).toBe('x');
  });
  it('id / optId: UUID no vacío', () => {
    expect(id('abc-123', 'categoria_id')).toBe('abc-123');
    expect(() => id('', 'categoria_id')).toThrow(/VALIDATION:categoria_id:REQUERIDO/);
    expect(optId(undefined, 'marca_id')).toBeUndefined();
  });
  it('int / num: tipo, entero, rango', () => {
    expect(int(3, 'cantidad')).toBe(3);
    expect(() => int(1.5, 'cantidad')).toThrow(/VALIDATION:cantidad:NO_ENTERO/);
    expect(() => int(-1, 'cantidad', { min: 0 })).toThrow(/VALIDATION:cantidad:MIN:0/);
    expect(num(2.5, 'factor')).toBe(2.5);
    expect(() => num('x', 'factor')).toThrow(/VALIDATION:factor:TIPO/);
  });
  it('centavos: entero >= 0', () => {
    expect(centavos(1500, 'precio_centavos')).toBe(1500);
    expect(() => centavos(-1, 'precio_centavos')).toThrow(/VALIDATION:precio_centavos:NEGATIVO/);
    expect(() => centavos(1.2, 'precio_centavos')).toThrow(/VALIDATION:precio_centavos:NO_ENTERO/);
  });
  it('bool y oneOf', () => {
    expect(bool(true, 'activo')).toBe(true);
    expect(() => bool('si', 'activo')).toThrow(/VALIDATION:activo:TIPO/);
    expect(oneOf('efectivo', 'medio', ['efectivo', 'tarjeta'] as const)).toBe('efectivo');
    expect(() => oneOf('cripto', 'medio', ['efectivo', 'tarjeta'] as const)).toThrow(/VALIDATION:medio:ENUM/);
  });
  it('arr: valida cada elemento con el índice en el campo', () => {
    expect(arr([1, 2], 'items', (x, i) => int(x, `items.${i}`))).toEqual([1, 2]);
    expect(() => arr('x', 'items', (x) => x)).toThrow(/VALIDATION:items:TIPO/);
    expect(() => arr([1, 'a'], 'items', (x, i) => int(x, `items.${i}`))).toThrow(/VALIDATION:items.1:TIPO/);
  });
  it('ValidationError expone field y detail', () => {
    try { str('', 'nombre'); } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('nombre');
      expect((e as ValidationError).detail).toBe('REQUERIDO');
    }
  });
});
