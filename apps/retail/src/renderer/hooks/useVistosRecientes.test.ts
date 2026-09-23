import { describe, it, expect, beforeEach } from 'vitest';
import { registrarVisto, leerVistos, MAX_VISTOS } from '@core/ui';

beforeEach(() => localStorage.clear());

describe('store de vistos recientemente (ADR-081 / PERF-2)', () => {
  it('registra y lee una entrada', () => {
    registrarVisto('u1', { tipo: 'producto', id: 'p1', etiqueta: 'Tornillo' });
    const vistos = leerVistos('u1');
    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toMatchObject({ tipo: 'producto', id: 'p1', etiqueta: 'Tornillo' });
  });

  it('el más reciente queda primero (LRU)', () => {
    registrarVisto('u1', { tipo: 'producto', id: 'p1', etiqueta: 'A' });
    registrarVisto('u1', { tipo: 'cliente', id: 'c1', etiqueta: 'B' });
    expect(leerVistos('u1').map((v) => v.id)).toEqual(['c1', 'p1']);
  });

  it('deduplica por tipo+id moviendo la entrada al frente', () => {
    registrarVisto('u1', { tipo: 'producto', id: 'p1', etiqueta: 'A' });
    registrarVisto('u1', { tipo: 'cliente', id: 'c1', etiqueta: 'B' });
    registrarVisto('u1', { tipo: 'producto', id: 'p1', etiqueta: 'A' });
    const vistos = leerVistos('u1');
    expect(vistos.map((v) => v.id)).toEqual(['p1', 'c1']);
    expect(vistos).toHaveLength(2);
  });

  it('un producto y un cliente con el mismo id NO se deduplican entre sí', () => {
    registrarVisto('u1', { tipo: 'producto', id: 'x', etiqueta: 'Prod' });
    registrarVisto('u1', { tipo: 'cliente', id: 'x', etiqueta: 'Cli' });
    expect(leerVistos('u1')).toHaveLength(2);
  });

  it(`topea en ${MAX_VISTOS} entradas`, () => {
    for (let i = 0; i < MAX_VISTOS + 3; i++) {
      registrarVisto('u1', { tipo: 'producto', id: `p${i}`, etiqueta: `P${i}` });
    }
    expect(leerVistos('u1')).toHaveLength(MAX_VISTOS);
    // el último registrado sigue presente, el primero se cayó
    expect(leerVistos('u1')[0].id).toBe(`p${MAX_VISTOS + 2}`);
    expect(leerVistos('u1').some((v) => v.id === 'p0')).toBe(false);
  });

  it('aísla por usuario', () => {
    registrarVisto('u1', { tipo: 'producto', id: 'p1', etiqueta: 'A' });
    expect(leerVistos('u2')).toEqual([]);
  });

  it('tolera JSON corrupto sin explotar', () => {
    localStorage.setItem('vistos_recientes_uu1', '{no es json');
    expect(leerVistos('u1')).toEqual([]);
  });
});
