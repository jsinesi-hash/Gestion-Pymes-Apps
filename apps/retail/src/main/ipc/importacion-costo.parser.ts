// Parser puro para archivos CSV/XLSX de listas de costos de proveedor.
// Sin efectos secundarios — todas las funciones son puras.
//
// Followup ADR-051: se eliminó el mapeo de columnas configurable por proveedor
// (letra/número de columna, fila de encabezado configurable). El formato ahora es FIJO
// por nombre de columna — igual criterio que las plantillas de Importar Datos: si el
// proveedor manda otro formato, se adapta el archivo antes de subirlo, no al revés.
// Encabezado siempre en la primera fila; delimitador de CSV auto-detectado (`;` o `,`).

import { leerCsv } from '@ferreteria/shared';

export type FilaParseada = {
  fila_num: number;
  datos_crudos: Record<string, string>;
  codigo_proveedor_archivo: string | null;
  gtin_archivo: string | null;
  codigo_interno_archivo: string | null;
  // ADR-063 Lote 4: nombre/descripción del producto tal como lo trae el proveedor.
  // Opcional; alimenta el matcher de similitud cuando no hay match por EAN/código.
  nombre_archivo: string | null;
  costo_centavos: number | null;
};

// Nombres de columna fijos (followup ADR-051). Terminología clara:
//   COD_PRODUCTO_PROV = código que EL PROVEEDOR le puso al producto (producto_proveedor.codigo_proveedor)
//   COD_INTERNO       = nuestro SKU interno (producto.sku)
export const HEADERS_FIJOS = {
  costo: 'COSTO',
  codigoProveedor: 'COD_PRODUCTO_PROV',
  gtin: 'EAN',
  codigoInterno: 'COD_INTERNO',
  // ADR-063 Lote 4: nombre/descripción del producto, opcional, para sugerir por similitud.
  // El nombre canónico de la columna es DESCRIPCION (plantilla + UI de Importar Costos);
  // NOMBRE se acepta como alias por compatibilidad con archivos/plantillas viejas.
  nombre: 'DESCRIPCION',
  nombreAlt: 'NOMBRE',
} as const;

// Parsea el contenido de un CSV en texto plano (encabezado siempre en la primera fila,
// delimitador auto-detectado). Retorna headers como Map<nombre_upper → índice> y filas
// de datos como arrays de strings.
export function parseCsvContent(
  content: string,
): { headers: Map<string, number>; rows: string[][] } {
  const [headerCells, ...rows] = leerCsv(content, { delimitador: 'auto', recortar: true });
  if (!headerCells) return { headers: new Map(), rows: [] };

  const headers = new Map<string, number>();
  headerCells.forEach((h, i) => { if (h) headers.set(h.toUpperCase(), i); });
  return { headers, rows };
}

// Mapea una fila parseada a los campos semánticos por nombre de columna fijo.
// El costo en el archivo se asume en pesos con hasta 2 decimales; se convierte a centavos.
export function mapearFila(
  row: string[],
  headers: Map<string, number>,
): Omit<FilaParseada, 'fila_num' | 'datos_crudos'> {
  const get = (nombreHeader: string): string | null => {
    const idx = headers.get(nombreHeader);
    if (idx === undefined) return null;
    const v = row[idx];
    return v?.trim() || null;
  };

  const costoRaw = get(HEADERS_FIJOS.costo);
  let costo_centavos: number | null = null;
  if (costoRaw) {
    const num = parseFloat(costoRaw.replace(',', '.'));
    if (!isNaN(num)) costo_centavos = Math.round(num * 100);
  }

  return {
    codigo_proveedor_archivo: get(HEADERS_FIJOS.codigoProveedor),
    gtin_archivo: get(HEADERS_FIJOS.gtin),
    codigo_interno_archivo: get(HEADERS_FIJOS.codigoInterno),
    nombre_archivo: get(HEADERS_FIJOS.nombre) ?? get(HEADERS_FIJOS.nombreAlt),
    costo_centavos,
  };
}
