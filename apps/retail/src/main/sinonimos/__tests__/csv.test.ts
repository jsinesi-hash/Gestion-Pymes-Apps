import { describe, it, expect } from 'vitest';
import { parsearCsvSinonimos } from '../csv';
import { SINONIMO_GRUPOS } from '../dataset';
import { validarSinonimos } from '../validar';

describe('parsearCsvSinonimos (ADR-067)', () => {
  it('parsea columnas, listas separadas por | y campos entre comillas', () => {
    const csv = [
      'canonico,sinonimos,abreviaturas,rubro,nota',
      'alicate,pinza|tenaza,alic.|alic,Herramientas,"En AR ""pinza"" = alicate; ojo"',
      'Philips,,phil.|phil,Marca,',
    ].join('\n');
    const { grupos, errores } = parsearCsvSinonimos(csv);
    expect(errores).toEqual([]);
    expect(grupos.length).toBe(2);
    expect(grupos[0]).toMatchObject({
      canonico: 'alicate',
      sinonimos: ['pinza', 'tenaza'],
      abreviaturas: ['alic.', 'alic'],
      rubro: 'Herramientas',
      nota: 'En AR "pinza" = alicate; ojo',
    });
    expect(grupos[1].sinonimos).toEqual([]);
    expect(grupos[1].abreviaturas).toEqual(['phil.', 'phil']);
  });

  it('reporta error si falta una columna del encabezado', () => {
    const { errores } = parsearCsvSinonimos('canonico,sinonimos\nalicate,pinza');
    expect(errores.length).toBeGreaterThan(0);
    expect(errores[0]).toMatch(/Faltan columnas/i);
  });

  it('saltea líneas vacías y filas sin canónico', () => {
    const csv = 'canonico,sinonimos,abreviaturas,rubro,nota\n\nalicate,pinza,,,\n,huerfano,,,';
    const { grupos } = parsearCsvSinonimos(csv);
    expect(grupos.map(g => g.canonico)).toEqual(['alicate']);
  });
});

describe('dataset embebido (ADR-067)', () => {
  it('parsea a >100 grupos y valida sin errores', () => {
    expect(SINONIMO_GRUPOS.length).toBeGreaterThan(100);
    const r = validarSinonimos(SINONIMO_GRUPOS);
    expect(r.errores).toEqual([]); // advertencias (dups entre grupos) están permitidas
  });

  it('incluye marcas y abreviaturas', () => {
    const philips = SINONIMO_GRUPOS.find(g => g.canonico === 'Philips');
    expect(philips?.abreviaturas).toContain('phil.');
    const tornillo = SINONIMO_GRUPOS.find(g => g.canonico === 'tornillo');
    expect(tornillo?.abreviaturas).toContain('torn.');
  });
});
