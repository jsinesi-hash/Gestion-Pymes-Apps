import { describe, it, expect } from 'vitest';
import { tokenizar, canonizarTokens, coeficienteDice, similitudNombres } from './similitud.js';

describe('similitud token-set (ADR-063 Lote 3)', () => {
  it('tokeniza normalizando (measure-aware)', () => {
    expect(tokenizar('Bulón 6 × 40 zincado')).toEqual(['bulon', '6x40', 'zincado']);
    expect(tokenizar('')).toEqual([]);
  });

  it('coeficiente de Dice', () => {
    expect(coeficienteDice(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(coeficienteDice(new Set(['a', 'b']), new Set(['a', 'c']))).toBeCloseTo(0.5);
    expect(coeficienteDice(new Set(['a']), new Set(['b']))).toBe(0);
    expect(coeficienteDice(new Set(), new Set(['a']))).toBe(0);
  });

  it('canoniza tokens con diccionario de sinónimos', () => {
    const dic = new Map([['pinza', 'alicate']]);
    expect([...canonizarTokens(['pinza', 'universal'], dic)].sort()).toEqual(['alicate', 'universal']);
  });

  it('sin diccionario, "pinza universal" vs "alicate universal" comparten sólo 1 token', () => {
    // 1 token común (universal) de 4 → Dice = 2·1/(2+2) = 0.5
    expect(similitudNombres('pinza universal', 'alicate universal')).toBeCloseTo(0.5);
  });

  it('con diccionario pinza→alicate, el match sube a 1', () => {
    const dic = new Map([['pinza', 'alicate']]);
    expect(similitudNombres('pinza universal', 'alicate universal', dic)).toBe(1);
  });

  it('los acentos no afectan (normalización compartida)', () => {
    expect(similitudNombres('Caño PVC', 'cano pvc')).toBe(1);
  });
});
