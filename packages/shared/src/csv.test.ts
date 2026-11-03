import { describe, it, expect } from 'vitest';
import { leerCsv, detectarDelimitador } from './csv.js';

// Hasta ahora había cuatro tokenizadores de CSV con comportamientos distintos (importar datos,
// importar costos, sinónimos, seed de geografía): solo uno manejaba saltos de línea dentro de
// comillas y solo uno no entendía `""`. Estos tests fijan el comportamiento único.
describe('detectarDelimitador', () => {
  it('elige ; si hay más punto y coma que comas en el encabezado', () => {
    expect(detectarDelimitador('a;b;c')).toBe(';');
  });
  it('elige , si hay más comas', () => {
    expect(detectarDelimitador('a,b,c')).toBe(',');
  });
  it('empata a favor de ; (criterio histórico de las plantillas)', () => {
    expect(detectarDelimitador('a;b,c')).toBe(';');
    expect(detectarDelimitador('abc')).toBe(';');
  });
  it('no cuenta separadores dentro de comillas', () => {
    expect(detectarDelimitador('"Nombre, apellido",edad,ciudad')).toBe(',');
    expect(detectarDelimitador('"a;b;c";x;y')).toBe(';');
    expect(detectarDelimitador('"a;b;c",x,y')).toBe(',');
  });
  it('mira solo la primera línea con contenido', () => {
    expect(detectarDelimitador('\n\na,b\n1;2;3;4')).toBe(',');
  });
});

describe('leerCsv', () => {
  it('parsea filas y celdas con coma por defecto', () => {
    expect(leerCsv('nombre,precio\nTornillo,100')).toEqual([['nombre', 'precio'], ['Tornillo', '100']]);
  });

  it('acepta \\r\\n, \\n y \\r como fin de fila', () => {
    expect(leerCsv('a,b\r\n1,2\r3,4\n5,6')).toEqual([['a', 'b'], ['1', '2'], ['3', '4'], ['5', '6']]);
  });

  it('un delimitador dentro de comillas no separa', () => {
    expect(leerCsv('n,d\n"Tornillo, galv",det')).toEqual([['n', 'd'], ['Tornillo, galv', 'det']]);
    expect(leerCsv('n;d\nT;"Rosca; galv"', { delimitador: ';' })).toEqual([['n', 'd'], ['T', 'Rosca; galv']]);
  });

  it('"" dentro de comillas es una comilla literal', () => {
    expect(leerCsv('a\n"dice ""hola"""')).toEqual([['a'], ['dice "hola"']]);
  });

  it('un salto de línea dentro de comillas queda en la celda', () => {
    expect(leerCsv('a,b\n"línea1\nlínea2",x')).toEqual([['a', 'b'], ['línea1\nlínea2', 'x']]);
    expect(leerCsv('a,b\r\n"l1\r\nl2",x')).toEqual([['a', 'b'], ['l1\nl2', 'x']]);
  });

  it('descarta filas vacías (líneas en blanco y filas de solo delimitadores)', () => {
    expect(leerCsv('a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(leerCsv('a,b\n,\n1,2\n  ,  \n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('una celda vacía en una fila con datos se conserva', () => {
    expect(leerCsv('a,b,c\n1,,3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
    expect(leerCsv('a,b\n1,')).toEqual([['a', 'b'], ['1', '']]);
  });

  it('texto vacío o solo blancos da []', () => {
    expect(leerCsv('')).toEqual([]);
    expect(leerCsv('\n  \n')).toEqual([]);
  });

  it('el último registro no necesita salto de línea final', () => {
    expect(leerCsv('a,b\n1,2')).toEqual(leerCsv('a,b\n1,2\n'));
  });

  it('quita el BOM de UTF-8 (Excel lo agrega y rompía el nombre de la primera columna)', () => {
    expect(leerCsv('﻿codigo,nombre\n1,x')).toEqual([['codigo', 'nombre'], ['1', 'x']]);
  });

  it('no recorta espacios salvo que se pida', () => {
    expect(leerCsv('a, b\n 1 , 2 ')).toEqual([['a', ' b'], [' 1 ', ' 2 ']]);
    expect(leerCsv('a, b\n 1 , 2 ', { recortar: true })).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('delimitador "auto" usa el del encabezado', () => {
    expect(leerCsv('nombre;precio\nTornillo;100', { delimitador: 'auto' })).toEqual([['nombre', 'precio'], ['Tornillo', '100']]);
    expect(leerCsv('nombre,precio\nTornillo,100', { delimitador: 'auto' })).toEqual([['nombre', 'precio'], ['Tornillo', '100']]);
  });

  it('con delimitador fijo ignora el otro separador', () => {
    expect(leerCsv('a;b,c\n1;2,3')).toEqual([['a;b', 'c'], ['1;2', '3']]);
  });

  it('una comilla de apertura sin cierre toma hasta el final sin romper', () => {
    expect(leerCsv('a,b\n1,"sin cerrar')).toEqual([['a', 'b'], ['1', 'sin cerrar']]);
  });
});
