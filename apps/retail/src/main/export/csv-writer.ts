import type { ColumnaExport } from '@ferreteria/shared';

const BOM = '﻿';
const SEP = ';';

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv<T extends Record<string, unknown>>(
  columnas: ColumnaExport<T>[],
  filas: T[],
): string {
  const header = columnas.map(c => escapeCell(c.label)).join(SEP);
  const rows = filas.map(fila =>
    columnas.map(col => {
      const raw = fila[col.campo];
      const formatted = col.formato ? col.formato(raw, fila) : raw;
      return escapeCell(formatted);
    }).join(SEP),
  );
  return BOM + [header, ...rows].join('\r\n');
}
