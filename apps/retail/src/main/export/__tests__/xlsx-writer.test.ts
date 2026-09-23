import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildXlsx } from '@core/main';
import type { ColumnaExport } from '@ferreteria/shared';

async function parseBuf(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  // ExcelJS v4 types Buffer with the pre-Node-22 definition; cast required
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  return wb.worksheets[0];
}

describe('buildXlsx', () => {
  const columnas: ColumnaExport[] = [
    { campo: 'nombre', label: 'Nombre' },
    { campo: 'precio', label: 'Precio', formatoXlsx: (v) => Number(v) },
  ];

  it('produce un buffer XLSX válido con encabezado en negrita', async () => {
    const buf = await buildXlsx(columnas, [{ nombre: 'Tornillo', precio: 100 }]);
    expect(buf.byteLength).toBeGreaterThan(0);
    const ws = await parseBuf(buf);
    const headerRow = ws.getRow(1);
    expect(headerRow.getCell(1).value).toBe('Nombre');
    expect(headerRow.getCell(1).font?.bold).toBe(true);
    expect(headerRow.getCell(2).value).toBe('Precio');
  });

  it('escribe datos en la fila 2 en adelante', async () => {
    const buf = await buildXlsx(columnas, [
      { nombre: 'Tornillo', precio: 100 },
      { nombre: 'Clavo', precio: 50 },
    ]);
    const ws = await parseBuf(buf);
    expect(ws.getRow(2).getCell(1).value).toBe('Tornillo');
    expect(ws.getRow(2).getCell(2).value).toBe(100);
    expect(ws.getRow(3).getCell(1).value).toBe('Clavo');
    expect(ws.getRow(3).getCell(2).value).toBe(50);
  });

  it('tabla vacía produce solo encabezado', async () => {
    const buf = await buildXlsx(columnas, []);
    const ws = await parseBuf(buf);
    expect(ws.rowCount).toBe(1);
  });

  it('usa formatoXlsx para celdas numéricas', async () => {
    const buf = await buildXlsx(columnas, [{ nombre: 'X', precio: 999 }]);
    const ws = await parseBuf(buf);
    const cell = ws.getRow(2).getCell(2);
    expect(typeof cell.value).toBe('number');
    expect(cell.value).toBe(999);
  });

  it('usa formato cuando no hay formatoXlsx', async () => {
    const cols: ColumnaExport[] = [
      { campo: 'estado', label: 'Estado', formato: (v) => v ? 'Sí' : 'No' },
    ];
    const buf = await buildXlsx(cols, [{ estado: true }]);
    const ws = await parseBuf(buf);
    expect(ws.getRow(2).getCell(1).value).toBe('Sí');
  });

  it('escribe fechas como objetos Date en XLSX', async () => {
    const cols: ColumnaExport[] = [
      { campo: 'fecha', label: 'Fecha',
        formatoXlsx: (v) => v instanceof Date ? v : new Date(v) },
    ];
    const date = new Date('2025-01-15T10:00:00Z');
    const buf = await buildXlsx(cols, [{ fecha: date }]);
    const ws = await parseBuf(buf);
    const cell = ws.getRow(2).getCell(1);
    expect(cell.value).toBeInstanceOf(Date);
  });

  it('usa el nombre de hoja pasado como argumento', async () => {
    const buf = await buildXlsx(columnas, [], 'MiHoja');
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets[0].name).toBe('MiHoja');
  });
});
