import { describe, it, expect } from 'vitest';
import { obtenerNotas, CHANGELOG } from '../changelog';

describe('changelog', () => {
  it('devuelve la entrada de una versión conocida', () => {
    const notas = obtenerNotas('1.1.0');
    expect(notas).not.toBeNull();
    expect(notas!.titulo).toMatch(/1\.1\.0/);
    expect(notas!.notas.length).toBeGreaterThan(0);
  });

  it('devuelve null para una versión sin entrada', () => {
    expect(obtenerNotas('99.99.99')).toBeNull();
  });

  it('todas las entradas tienen título y al menos una nota', () => {
    for (const [version, entrada] of Object.entries(CHANGELOG)) {
      expect(entrada.titulo, `título de ${version}`).toBeTruthy();
      expect(entrada.notas.length, `notas de ${version}`).toBeGreaterThan(0);
    }
  });
});
