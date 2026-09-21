import { describe, it, expect } from 'vitest';
import { construirCsvReporte } from './reporteImportacion';

type Fila = { fila: number; nombre: string; estado: string };

const COLS = [
  { header: 'fila', valor: (f: Fila) => f.fila },
  { header: 'nombre', valor: (f: Fila) => f.nombre },
  { header: 'estado', valor: (f: Fila) => f.estado },
];

describe('construirCsvReporte (ADR-081 / PRICE-4, convención ADR-EXP-03)', () => {
  it('arranca con BOM UTF-8', () => {
    const csv = construirCsvReporte([], COLS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('usa separador ; y saltos CRLF', () => {
    const csv = construirCsvReporte([{ fila: 1, nombre: 'Ana', estado: 'error' }], COLS);
    const cuerpo = csv.slice(1); // sin BOM
    const lineas = cuerpo.split('\r\n');
    expect(lineas[0]).toBe('fila;nombre;estado');
    expect(lineas[1]).toBe('1;Ana;error');
  });

  it('escapa celdas con ; comillas o saltos según RFC 4180', () => {
    const csv = construirCsvReporte(
      [{ fila: 2, nombre: 'Perno; "especial"', estado: 'a\nb' }],
      COLS,
    );
    const linea = csv.slice(1).split('\r\n')[1];
    expect(linea).toBe('2;"Perno; ""especial""";"a\nb"');
  });

  it('representa null/undefined como celda vacía', () => {
    const csv = construirCsvReporte(
      [{ fila: 3, nombre: null as any, estado: undefined as any }],
      COLS,
    );
    expect(csv.slice(1).split('\r\n')[1]).toBe('3;;');
  });
});
