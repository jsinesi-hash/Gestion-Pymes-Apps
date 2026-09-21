import { describe, it, expect } from 'vitest';
import { parseBooleanoImport } from './booleano.js';

describe('parseBooleanoImport', () => {
  it('reconoce tokens verdaderos (incl. si/sí)', () => {
    for (const t of ['si', 'sí', 'S', 'true', 'Verdadero', 'v', '1', 'x', ' SI ']) {
      expect(parseBooleanoImport(t, { default: false })).toEqual({ ok: true, value: true });
    }
  });
  it('reconoce tokens falsos', () => {
    for (const t of ['no', 'N', 'false', 'Falso', 'f', '0']) {
      expect(parseBooleanoImport(t, { default: true })).toEqual({ ok: true, value: false });
    }
  });
  it('celda vacía usa el default provisto', () => {
    expect(parseBooleanoImport('', { default: true })).toEqual({ ok: true, value: true });
    expect(parseBooleanoImport('   ', { default: false })).toEqual({ ok: true, value: false });
  });
  it('token no reconocido devuelve ok:false', () => {
    expect(parseBooleanoImport('tal vez', { default: true })).toEqual({ ok: false });
    expect(parseBooleanoImport('2', { default: false })).toEqual({ ok: false });
  });
});
