import { describe, it, expect } from 'vitest';
import { buildCsv } from './csv-writer';
import type { ColumnaExport } from '@ferreteria/shared';

const BOM = '﻿';

describe('buildCsv', () => {
  const columnas: ColumnaExport[] = [
    { campo: 'nombre', label: 'Nombre' },
    { campo: 'precio', label: 'Precio', formato: (v) => `$${v}` },
  ];

  it('produce encabezado BOM UTF-8 + cabecera + filas con separador ;', () => {
    const csv = buildCsv(columnas, [{ nombre: 'Tornillo', precio: 100 }]);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(BOM.length).split('\r\n');
    expect(lines[0]).toBe('Nombre;Precio');
    expect(lines[1]).toBe('Tornillo;$100');
  });

  it('tabla vacía produce solo encabezado', () => {
    const csv = buildCsv(columnas, []);
    const lines = csv.slice(BOM.length).split('\r\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('Nombre;Precio');
  });

  it('escapa celdas con ; entre comillas dobles', () => {
    const csv = buildCsv(
      [{ campo: 'val', label: 'Val' }],
      [{ val: 'uno;dos' }],
    );
    expect(csv).toContain('"uno;dos"');
  });

  it('escapa comillas dobles duplicándolas', () => {
    const csv = buildCsv(
      [{ campo: 'val', label: 'Val' }],
      [{ val: 'di"jo' }],
    );
    expect(csv).toContain('"di""jo"');
  });

  it('valores null o undefined se convierten a cadena vacía', () => {
    const csv = buildCsv(
      [{ campo: 'val', label: 'Val' }],
      [{ val: null }, { val: undefined }],
    );
    const lines = csv.slice(BOM.length).split('\r\n');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('');
  });

  it('usa formato cuando está definido', () => {
    const csv = buildCsv(columnas, [{ nombre: 'Clavo', precio: 50 }]);
    expect(csv).toContain('$50');
  });

  it('devuelve string con terminadores CRLF entre filas', () => {
    const csv = buildCsv(columnas, [
      { nombre: 'A', precio: 1 },
      { nombre: 'B', precio: 2 },
    ]);
    expect(csv).toContain('\r\n');
  });
});
