import { describe, it, expect } from 'vitest';
import { canonicalizarUbicacion, canonicalizarCodigoUbicacion } from './ubicacion';

describe('canonicalizarUbicacion', () => {
  it('saca ceros a la izquierda en segmentos numéricos y pasa a mayúsculas', () => {
    expect(canonicalizarUbicacion('a', '0', '01')).toEqual({
      sector: 'A', estante: '0', posicion: '1', codigo: 'A-0-1',
    });
  });

  it('colapsa 0-1 y 0-01 (y 00-1) a la misma canónica', () => {
    const a = canonicalizarUbicacion('A', '0', '1');
    const b = canonicalizarUbicacion('A', '0', '01');
    const c = canonicalizarUbicacion('A', '00', '1');
    expect(a.codigo).toBe('A-0-1');
    expect(b.codigo).toBe('A-0-1');
    expect(c.codigo).toBe('A-0-1');
  });

  it('trimea y normaliza 007 -> 7', () => {
    expect(canonicalizarUbicacion(' a ', '007', '03')).toEqual({
      sector: 'A', estante: '7', posicion: '3', codigo: 'A-7-3',
    });
  });

  it('conserva un cero solitario', () => {
    expect(canonicalizarUbicacion('A', '0', '0').codigo).toBe('A-0-0');
  });

  it('deja intactos (salvo trim/upper) los segmentos no numéricos', () => {
    expect(canonicalizarUbicacion('A', 'ext', '2')).toEqual({
      sector: 'A', estante: 'EXT', posicion: '2', codigo: 'A-EXT-2',
    });
  });
});

describe('canonicalizarCodigoUbicacion', () => {
  it('saca ceros a la izquierda por segmento sobre un código ya formado', () => {
    expect(canonicalizarCodigoUbicacion('A-01-03')).toBe('A-1-3');
  });

  it('pasa a mayúsculas y trimea (case-insensitive)', () => {
    expect(canonicalizarCodigoUbicacion(' a-1-3 ')).toBe('A-1-3');
    expect(canonicalizarCodigoUbicacion('a-01-03')).toBe('A-1-3');
  });

  it('colapsa las variantes legacy y canónica al mismo código', () => {
    expect(canonicalizarCodigoUbicacion('A-01-03'))
      .toBe(canonicalizarCodigoUbicacion('A-1-3'));
  });

  it('conserva segmentos no numéricos y ceros solitarios', () => {
    expect(canonicalizarCodigoUbicacion('A-EXT-0')).toBe('A-EXT-0');
    expect(canonicalizarCodigoUbicacion('a-ext-00')).toBe('A-EXT-0');
  });
});
