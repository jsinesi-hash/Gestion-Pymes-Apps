import { describe, it, expect } from 'vitest';
import { ars, arsDecimal, fecha, estadoStock } from './helpers';

describe('ars', () => {
  it('formatea pesos con coma decimal', () => {
    expect(ars(1500)).toBe('1500,00');
    expect(ars(1234.5)).toBe('1234,50');
    expect(ars(0)).toBe('0,00');
  });
});

describe('arsDecimal', () => {
  it('formatea pesos con punto decimal (para reimportable)', () => {
    expect(arsDecimal(1500)).toBe('1500.00');
    expect(arsDecimal(1234.5)).toBe('1234.50');
  });
});

describe('fecha', () => {
  it('formatea fecha ISO como dd/mm/yyyy', () => {
    expect(fecha('2026-06-18T00:00:00.000Z')).toMatch(/\d{1,2}\/6\/2026/);
  });
  it('acepta objeto Date', () => {
    expect(fecha(new Date('2026-01-15T12:00:00Z'))).toMatch(/15\/1\/2026/);
  });
});

describe('estadoStock', () => {
  it('sin stock cuando n=0', () => { expect(estadoStock(0, 10)).toBe('sin stock'); });
  it('bajo cuando n <= umbral positivo', () => { expect(estadoStock(5, 10)).toBe('bajo'); });
  it('en stock cuando n > umbral', () => { expect(estadoStock(11, 10)).toBe('en stock'); });
  it('en stock cuando umbral=0 y hay stock', () => { expect(estadoStock(1, 0)).toBe('en stock'); });
});
