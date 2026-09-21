import { describe, it, expect } from 'vitest';
import { generarLayoutHoja } from '@ferreteria/shared';
import type { PerfilEtiqueta, EtiquetaItem } from '@ferreteria/shared';

const ITEM = (i: number): EtiquetaItem => ({
  producto_id: `p${i}`,
  sku: `SKU-${String(i).padStart(4, '0')}`,
  nombre: `Producto ${i}`,
  precio_venta_lista_centavos: (i + 1) * 1000,
  gtin_barcode: null,
});

const PERFIL_HOJA: PerfilEtiqueta = {
  id: 'h1',
  nombre: 'A4 3x8',
  tipo: 'hoja',
  ancho_mm: 210,
  alto_mm: 297,
  cols: 3,
  filas: 8,
  margen_mm: 10,
  gap_mm: 2,
  barcode_tipo: 'code128',
};

const PERFIL_ROLLO: PerfilEtiqueta = {
  id: 'r1',
  nombre: 'Rollo 70x36',
  tipo: 'rollo',
  ancho_mm: 70,
  alto_mm: 36,
  barcode_tipo: 'qr',
};

// celda_ancho = (210 - 2*10 - (3-1)*2) / 3 = 186/3 = 62
// celda_alto  = (297 - 2*10 - (8-1)*2) / 8 = 263/8 = 32.875
const CELDA_ANCHO = (210 - 2 * 10 - (3 - 1) * 2) / 3;
const CELDA_ALTO  = (297 - 2 * 10 - (8 - 1) * 2) / 8;

describe('generarLayoutHoja — tipo hoja', () => {
  it('retorna array vacío para items vacíos', () => {
    expect(generarLayoutHoja(PERFIL_HOJA, [], 0)).toHaveLength(0);
  });

  it('primer item en pagina 0, posición margen_mm (col 0, row 0)', () => {
    const layouts = generarLayoutHoja(PERFIL_HOJA, [ITEM(0)], 0);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].pagina).toBe(0);
    expect(layouts[0].x_mm).toBeCloseTo(10); // margen_mm
    expect(layouts[0].y_mm).toBeCloseTo(10); // margen_mm
    expect(layouts[0].ancho_mm).toBeCloseTo(CELDA_ANCHO);
    expect(layouts[0].alto_mm).toBeCloseTo(CELDA_ALTO);
    expect(layouts[0].item).toEqual(ITEM(0));
  });

  it('segundo item en col 1 (x += celda_ancho + gap)', () => {
    const layouts = generarLayoutHoja(PERFIL_HOJA, [ITEM(0), ITEM(1)], 0);
    expect(layouts[1].x_mm).toBeCloseTo(10 + CELDA_ANCHO + 2); // margen + celda + gap
    expect(layouts[1].y_mm).toBeCloseTo(10); // misma fila
    expect(layouts[1].pagina).toBe(0);
  });

  it('cuarto item (col 0, row 1): x vuelve a margen, y += celda_alto + gap', () => {
    const items = Array.from({ length: 4 }, (_, i) => ITEM(i));
    const layouts = generarLayoutHoja(PERFIL_HOJA, items, 0);
    expect(layouts[3].x_mm).toBeCloseTo(10); // col 0
    expect(layouts[3].y_mm).toBeCloseTo(10 + CELDA_ALTO + 2); // row 1
  });

  it('celdaInicio=3 salta las primeras 3 celdas (primera col de row 1)', () => {
    const layouts = generarLayoutHoja(PERFIL_HOJA, [ITEM(0)], 3);
    expect(layouts[0].x_mm).toBeCloseTo(10); // col 0
    expect(layouts[0].y_mm).toBeCloseTo(10 + CELDA_ALTO + 2); // row 1
    expect(layouts[0].pagina).toBe(0);
  });

  it('desborda a pagina 1 cuando los items llenan la primera hoja', () => {
    const totalCeldas = 3 * 8; // 24
    const items = Array.from({ length: totalCeldas + 1 }, (_, i) => ITEM(i));
    const layouts = generarLayoutHoja(PERFIL_HOJA, items, 0);
    expect(layouts[totalCeldas].pagina).toBe(1);
    expect(layouts[totalCeldas].x_mm).toBeCloseTo(10); // vuelve a col 0 en nueva hoja
    expect(layouts[totalCeldas].y_mm).toBeCloseTo(10); // vuelve a row 0 en nueva hoja
  });

  it('celdaInicio=23 (última celda de hoja 0) → segundo item ya en pagina 1', () => {
    const layouts = generarLayoutHoja(PERFIL_HOJA, [ITEM(0), ITEM(1)], 23);
    expect(layouts[0].pagina).toBe(0);
    expect(layouts[1].pagina).toBe(1);
  });
});

describe('generarLayoutHoja — tipo rollo', () => {
  it('retorna array vacío para items vacíos', () => {
    expect(generarLayoutHoja(PERFIL_ROLLO, [], 0)).toHaveLength(0);
  });

  it('cada item en (0,0), dimensiones del perfil, pagina = índice', () => {
    const layouts = generarLayoutHoja(PERFIL_ROLLO, [ITEM(0), ITEM(1), ITEM(2)], 0);
    expect(layouts).toHaveLength(3);
    layouts.forEach((l, i) => {
      expect(l.x_mm).toBe(0);
      expect(l.y_mm).toBe(0);
      expect(l.ancho_mm).toBe(70);
      expect(l.alto_mm).toBe(36);
      expect(l.pagina).toBe(i);
      expect(l.item).toEqual(ITEM(i));
    });
  });

  it('ignora cols/filas/celdaInicio/margen/gap para perfiles rollo (robustez)', () => {
    const perfilConCamposHoja: PerfilEtiqueta = {
      ...PERFIL_ROLLO,
      cols: 3,
      filas: 8,
      margen_mm: 10,
      gap_mm: 2,
    };
    const layouts = generarLayoutHoja(perfilConCamposHoja, [ITEM(0), ITEM(1)], 99);
    // Debe comportarse como rollo: cada item en (0,0) en su propia página
    expect(layouts[0].x_mm).toBe(0);
    expect(layouts[0].y_mm).toBe(0);
    expect(layouts[0].pagina).toBe(0);
    expect(layouts[1].pagina).toBe(1);
    expect(layouts[1].x_mm).toBe(0);
  });
});
