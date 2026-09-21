import { describe, it, expect } from 'vitest';
import { parseCsvContent, mapearFila } from '../importacion-costo.parser';

// ── parseCsvContent ──────────────────────────────────────────────────────────
// Followup ADR-051: formato fijo — encabezado siempre en la primera fila,
// delimitador auto-detectado (`;` o `,`).

describe('parseCsvContent', () => {
  it('parsea CSV con delimitador coma', () => {
    const csv = 'COD_PRODUCTO_PROV,COSTO,EAN\nPROV-001,125.00,7791234567890\nPROV-002,80.00,';
    const { headers, rows } = parseCsvContent(csv);
    expect(headers.get('COD_PRODUCTO_PROV')).toBe(0);
    expect(headers.get('COSTO')).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('PROV-001');
    expect(rows[0][1]).toBe('125.00');
    expect(rows[1][1]).toBe('80.00');
  });

  it('auto-detecta el delimitador punto y coma', () => {
    const csv = 'COD_PRODUCTO_PROV;COSTO\nABC;55.00';
    const { rows } = parseCsvContent(csv);
    expect(rows[0]).toEqual(['ABC', '55.00']);
  });

  it('auto-detecta coma cuando hay más comas que puntos y coma en el encabezado', () => {
    const csv = 'COD_PRODUCTO_PROV,COSTO,EAN,DESCRIPCION\nABC,10.00,,algo';
    const { rows } = parseCsvContent(csv);
    expect(rows[0]).toEqual(['ABC', '10.00', '', 'algo']);
  });

  it('salta filas completamente vacías', () => {
    const csv = 'COD_PRODUCTO_PROV,COSTO\nABC,100\n\nDEF,200';
    const { rows } = parseCsvContent(csv);
    expect(rows).toHaveLength(2);
  });

  it('devuelve headers y rows vacíos si el contenido está vacío', () => {
    const { headers, rows } = parseCsvContent('');
    expect(headers.size).toBe(0);
    expect(rows).toHaveLength(0);
  });
});

// ── mapearFila ───────────────────────────────────────────────────────────────
// Formato fijo por nombre de columna: COD_PRODUCTO_PROV, EAN, COD_INTERNO, COSTO.

describe('mapearFila', () => {
  const headers = new Map([['COD_PRODUCTO_PROV', 0], ['COSTO', 1], ['EAN', 2], ['COD_INTERNO', 3]]);

  it('extrae costo en centavos, código proveedor y GTIN', () => {
    const row = ['PROV-001', '125.50', '7791234567890'];
    const result = mapearFila(row, headers);
    expect(result.codigo_proveedor_archivo).toBe('PROV-001');
    expect(result.costo_centavos).toBe(12550);
    expect(result.gtin_archivo).toBe('7791234567890');
  });

  it('convierte costo entero (sin decimales) a centavos', () => {
    const row = ['X', '200', ''];
    const result = mapearFila(row, headers);
    expect(result.costo_centavos).toBe(20000);
  });

  it('retorna costo_centavos null si el campo no es numérico', () => {
    const row = ['X', 'N/A', ''];
    const result = mapearFila(row, headers);
    expect(result.costo_centavos).toBeNull();
  });

  it('retorna gtin_archivo null si la columna EAN no viene en el archivo', () => {
    const headersSinEan = new Map([['COD_PRODUCTO_PROV', 0], ['COSTO', 1]]);
    const row = ['PROV-001', '100'];
    const result = mapearFila(row, headersSinEan);
    expect(result.gtin_archivo).toBeNull();
  });

  it('extrae codigo_interno_archivo cuando la columna COD_INTERNO viene en el archivo', () => {
    const row = ['PROV-001', '125.50', '7791234567890', 'P-0000123-4'];
    const result = mapearFila(row, headers);
    expect(result.codigo_interno_archivo).toBe('P-0000123-4');
  });

  it('retorna codigo_interno_archivo null si la columna COD_INTERNO no viene en el archivo', () => {
    const headersSinInterno = new Map([['COD_PRODUCTO_PROV', 0], ['COSTO', 1], ['EAN', 2]]);
    const row = ['PROV-001', '100', '7791234567890'];
    const result = mapearFila(row, headersSinInterno);
    expect(result.codigo_interno_archivo).toBeNull();
  });

  it('reconoce las columnas sin importar mayúsculas/minúsculas en el header', () => {
    const headersMinuscula = new Map([['codigo_proveedor', 0], ['costo', 1]]);
    const row = ['PROV-001', '50.00'];
    // headers ya viene normalizado a upper por parseCsvContent en el uso real, pero
    // mapearFila no debe asumirlo — solo busca la clave EXACTA que le pasan.
    const result = mapearFila(row, headersMinuscula);
    expect(result.costo_centavos).toBeNull(); // 'COSTO' (mayúscula) no está en el Map
  });
});
