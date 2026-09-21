import { describe, it, expect } from 'vitest';
import { checkDigit, formatSku, parseSku, SkuParseError } from './sku';

describe('checkDigit', () => {
  it('es determinístico para el mismo input', () => {
    expect(checkDigit(1)).toBe(checkDigit(1));
    expect(checkDigit(42)).toBe(checkDigit(42));
    expect(checkDigit(9999999)).toBe(checkDigit(9999999));
  });

  it('produce dígito en rango 0-9', () => {
    for (let i = 1; i <= 30; i++) {
      const d = checkDigit(i);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(9);
    }
  });

  it('detecta un solo dígito cambiado', () => {
    expect(checkDigit(1000001)).not.toBe(checkDigit(1000002));
    expect(checkDigit(1234500)).not.toBe(checkDigit(1234501));
  });

  it('detecta transposición de dos dígitos distintos', () => {
    // 1234567 vs 1234576 — últimos dos dígitos transpuestos
    expect(checkDigit(1234567)).not.toBe(checkDigit(1234576));
  });
});

describe('formatSku', () => {
  it('formatea secuencial 1 como P-0000001-{cd}', () => {
    const sku = formatSku(1);
    expect(sku).toMatch(/^P-0000001-\d$/);
  });

  it('formatea secuencial 42 como P-0000042-{cd}', () => {
    const sku = formatSku(42);
    expect(sku).toMatch(/^P-0000042-\d$/);
  });

  it('formatea secuencial 9999999 correctamente', () => {
    const sku = formatSku(9999999);
    expect(sku).toMatch(/^P-9999999-\d$/);
  });

  it('el check digit en formatSku coincide con checkDigit', () => {
    for (const n of [1, 42, 100, 9999, 9999999]) {
      const sku = formatSku(n);
      const cd = parseInt(sku.split('-')[2], 10);
      expect(cd).toBe(checkDigit(n));
    }
  });
});

describe('parseSku', () => {
  it('hace roundtrip de la salida de formatSku', () => {
    for (const n of [1, 42, 100, 9999999]) {
      const sku = formatSku(n);
      const result = parseSku(sku);
      expect(result.secuencial).toBe(n);
    }
  });

  it('lanza SkuParseError para formato incorrecto', () => {
    expect(() => parseSku('P-123-4')).toThrow(SkuParseError);
    expect(() => parseSku('7891234560001')).toThrow(SkuParseError);
    expect(() => parseSku('')).toThrow(SkuParseError);
    expect(() => parseSku('P-AAAAAAA-0')).toThrow(SkuParseError);
    expect(() => parseSku('p-0000001-9')).toThrow(SkuParseError);
  });

  it('lanza SkuParseError para check digit incorrecto', () => {
    const sku = formatSku(42);
    const parts = sku.split('-');
    const correctCd = parseInt(parts[2], 10);
    const wrongCd = (correctCd + 1) % 10;
    expect(() => parseSku(`P-${parts[1]}-${wrongCd}`)).toThrow(SkuParseError);
  });

  it('el mensaje de error menciona el SKU inválido', () => {
    try { parseSku('BAD'); } catch (e) {
      expect(e).toBeInstanceOf(SkuParseError);
      expect((e as SkuParseError).message).toContain('BAD');
    }
  });
});
