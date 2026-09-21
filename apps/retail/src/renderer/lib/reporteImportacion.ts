// Reporte de errores/impacto descargable, unificado para todas las importaciones
// (ADR-081 / PRICE-4). Usa la convención CSV de ADR-EXP-03: BOM UTF-8 + separador `;` +
// CRLF + escape RFC 4180, para que Excel-AR lo abra con doble clic sin mojibake ni
// colisión con la coma decimal.

export type ColumnaReporte<T> = {
  header: string;
  valor: (fila: T) => string | number | null | undefined;
};

const BOM = '﻿';

function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const s = String(valor);
  if (/[;"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Arma el string CSV (con BOM). Puro y testeable, sin tocar el DOM. */
export function construirCsvReporte<T>(filas: T[], columnas: ColumnaReporte<T>[]): string {
  const lineas = [columnas.map((c) => celda(c.header)).join(';')];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => celda(c.valor(fila))).join(';'));
  }
  return BOM + lineas.join('\r\n');
}

/** Genera y dispara la descarga del reporte como .csv. */
export function descargarReporteImportacion<T>(
  filas: T[],
  columnas: ColumnaReporte<T>[],
  nombreArchivo: string,
): void {
  const csv = construirCsvReporte(filas, columnas);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
