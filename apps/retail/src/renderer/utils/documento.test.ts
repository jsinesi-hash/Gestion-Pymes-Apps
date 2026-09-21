import { describe, it, expect } from 'vitest';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from './documento';

describe('formatDocumento', () => {
  describe('CUIT / CUIL', () => {
    it('0-2 dígitos: sin guiones', () => {
      expect(formatDocumento('CUIT', '2')).toBe('2');
      expect(formatDocumento('CUIT', '20')).toBe('20');
    });
    it('3-10 dígitos: un guión después de los 2 primeros', () => {
      expect(formatDocumento('CUIT', '201')).toBe('20-1');
      expect(formatDocumento('CUIT', '2012345678')).toBe('20-12345678');
    });
    it('11 dígitos: formato completo XX-XXXXXXXX-X', () => {
      expect(formatDocumento('CUIT', '20123456789')).toBe('20-12345678-9');
    });
    it('ignora caracteres no-dígito en el input', () => {
      expect(formatDocumento('CUIT', '20-123456789')).toBe('20-12345678-9');
    });
    it('limita a 11 dígitos', () => {
      expect(formatDocumento('CUIT', '201234567890')).toBe('20-12345678-9');
    });
    it('CUIL mismo comportamiento que CUIT', () => {
      expect(formatDocumento('CUIL', '27111222334')).toBe('27-11122233-4');
    });
  });

  describe('DNI', () => {
    it('solo dígitos, sin guiones', () => {
      expect(formatDocumento('DNI', '12345678')).toBe('12345678');
    });
    it('limita a 8 dígitos', () => {
      expect(formatDocumento('DNI', '123456789')).toBe('12345678');
    });
    it('ignora caracteres no-dígito', () => {
      expect(formatDocumento('DNI', '1234abc')).toBe('1234');
    });
  });
});

describe('validarDocumento', () => {
  it('CUIT válido (11 dígitos con guiones): null', () => {
    expect(validarDocumento('CUIT', '20-12345678-9')).toBeNull();
  });
  it('CUIT solo dígitos sin guiones: null si son 11', () => {
    expect(validarDocumento('CUIT', '20123456789')).toBeNull();
  });
  it('CUIT con menos de 11 dígitos: error', () => {
    expect(validarDocumento('CUIT', '2012345678')).not.toBeNull();
  });
  it('CUIL válido: null', () => {
    expect(validarDocumento('CUIL', '27-11122233-4')).toBeNull();
  });
  it('DNI 8 dígitos: null', () => {
    expect(validarDocumento('DNI', '12345678')).toBeNull();
  });
  it('DNI 7 dígitos: null', () => {
    expect(validarDocumento('DNI', '1234567')).toBeNull();
  });
  it('DNI 6 dígitos: error', () => {
    expect(validarDocumento('DNI', '123456')).not.toBeNull();
  });
  it('DNI más de 8 dígitos: error', () => {
    expect(validarDocumento('DNI', '123456789')).not.toBeNull();
  });
});

describe('validarTelefono', () => {
  it('vacío: null (campo opcional)', () => {
    expect(validarTelefono('')).toBeNull();
  });
  it('solo dígitos: null', () => {
    expect(validarTelefono('1112345678')).toBeNull();
  });
  it('con guiones, espacios, paréntesis, +: null', () => {
    expect(validarTelefono('+54 (11) 1234-5678')).toBeNull();
  });
  it('con letras: error', () => {
    expect(validarTelefono('11-abc-5678')).not.toBeNull();
  });
});

describe('validarCodigoPostal', () => {
  it('vacío: null (campo opcional)', () => {
    expect(validarCodigoPostal('')).toBeNull();
  });
  it('numérico hasta 8 chars: null', () => {
    expect(validarCodigoPostal('1000')).toBeNull();
  });
  it('alfanumérico (ej. CP argentino antiguo): null', () => {
    expect(validarCodigoPostal('B1900')).toBeNull();
  });
  it('más de 8 chars: error', () => {
    expect(validarCodigoPostal('123456789')).not.toBeNull();
  });
});
