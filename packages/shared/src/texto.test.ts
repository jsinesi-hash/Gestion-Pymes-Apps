import { describe, it, expect } from 'vitest';
import { normalizar } from './texto.js';

describe('normalizar (ADR-063/ADR-067)', () => {
  it('minúsculas y sin acentos (ñ→n)', () => {
    expect(normalizar('Llave Inglesa')).toBe('llave inglesa');
    expect(normalizar('Lámpara')).toBe('lampara');
    expect(normalizar('CAÑO')).toBe('cano');
  });

  it('canoniza medidas: variantes de x/× y espacios → NxM', () => {
    expect(normalizar('Bulón 6 × 40')).toBe('bulon 6x40');
    expect(normalizar('bulon 6 x 40')).toBe('bulon 6x40');
    expect(normalizar('6x40')).toBe('6x40');
    expect(normalizar('perfil 6 x 40 x 2')).toBe('perfil 6x40x2');
  });

  it('preserva unidades y colapsa el resto de la puntuación', () => {
    expect(normalizar('Caño 3/4"')).toBe('cano 3 4');
    expect(normalizar('cable 2.5mm2')).toBe('cable 2 5mm2');
    expect(normalizar('destornillador—phillips')).toBe('destornillador phillips');
    expect(normalizar('  varios   espacios  ')).toBe('varios espacios');
  });

  it('tolera null/undefined', () => {
    expect(normalizar(undefined as unknown as string)).toBe('');
  });

  // Enmienda a ADR-063/067: pega la unidad al número cuando viene separada por espacio,
  // para que "8 mm" y "8mm" tokenicen igual (mejora búsqueda por similitud y matching).
  // NO borra la unidad ni la infiere; solo canoniza el formato. Fracciones/pulgadas se
  // dejan como están (decisión tomada: no se preservan).
  describe('canonicalización de unidad con espacio', () => {
    it('pega dígito + espacio(s) + unidad conocida (mm/cm/m)', () => {
      expect(normalizar('Tornillo 8 mm')).toBe('tornillo 8mm');
      expect(normalizar('Tornillo 8 MM cabeza plana')).toBe('tornillo 8mm cabeza plana');
      expect(normalizar('Nivel 60 cm')).toBe('nivel 60cm');
      expect(normalizar('Caño 8 m')).toBe('cano 8m');
    });

    it('es equivalente al nombre con la unidad ya pegada', () => {
      expect(normalizar('Tornillo 8 mm')).toBe(normalizar('Tornillo 8mm'));
    });

    it('no colapsa cm con mm (unidades distintas se preservan)', () => {
      expect(normalizar('Tarugo 8 cm')).toBe('tarugo 8cm');
      expect(normalizar('Tarugo 8 cm')).not.toBe(normalizar('Tarugo 8 mm'));
    });

    it('NO pega la "m" a una palabra que empieza con m (no come "metros")', () => {
      expect(normalizar('Cinta 8 metros')).toBe('cinta 8 metros');
      expect(normalizar('Manguera 3 cmara')).toBe('manguera 3 cmara');
    });

    it('es idempotente con la unidad separada', () => {
      const x = 'Tornillo 8 mm cabeza plana';
      expect(normalizar(normalizar(x))).toBe(normalizar(x));
    });
  });
});
