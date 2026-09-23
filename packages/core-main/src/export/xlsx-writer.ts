import ExcelJS from 'exceljs';
import type { ColumnaExport } from '@ferreteria/shared';

export async function buildXlsx<T extends Record<string, unknown>>(
  columnas: ColumnaExport<T>[],
  filas: T[],
  nombreHoja = 'Datos',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nombreHoja);

  const headerRow = ws.addRow(columnas.map(c => c.label));
  headerRow.eachCell(cell => { cell.font = { bold: true }; });

  for (const fila of filas) {
    ws.addRow(
      columnas.map(col => {
        const raw = fila[col.campo];
        if (col.formatoXlsx) return col.formatoXlsx(raw, fila);
        if (col.formato) return col.formato(raw, fila);
        return raw ?? '';
      }),
    );
  }

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}
