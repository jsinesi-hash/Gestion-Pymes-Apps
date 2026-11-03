// Lector de CSV único del monorepo (TypeScript puro, browser-safe).
//
// Reemplaza a cuatro tokenizadores casi idénticos —importar datos, importar costos, sinónimos y el
// seed de geografía— que se habían separado en detalles: solo uno aceptaba saltos de línea dentro de
// comillas y otro no entendía `""` como comilla literal. Escribir el CSV es otra cosa
// (`buildCsv` en @core/main).

export type DelimitadorCsv = ',' | ';';

export type OpcionesCsv = {
  /** `'auto'` lo deduce del encabezado (`detectarDelimitador`). Por defecto `,`. */
  delimitador?: DelimitadorCsv | 'auto';
  /** Recorta los espacios de cada celda. Por defecto no: el que consume decide. */
  recortar?: boolean;
};

const BOM = '﻿';

const normalizar = (texto: string): string =>
  (texto.startsWith(BOM) ? texto.slice(1) : texto).replace(/\r\n?/g, '\n');

/**
 * `;` si el encabezado tiene tantos o más `;` que `,`, si no `,` (las plantillas de la app usan `;`
 * y una planilla en español exportada desde Excel también). Mira solo la primera línea con
 * contenido y no cuenta separadores dentro de comillas.
 */
export function detectarDelimitador(texto: string): DelimitadorCsv {
  const s = normalizar(texto);
  let puntoYComa = 0;
  let coma = 0;
  let enComillas = false;
  let hayContenido = false;
  for (const c of s) {
    if (c === '"') { enComillas = !enComillas; hayContenido = true; continue; }
    if (enComillas) continue;
    if (c === '\n') {
      if (hayContenido) break;
      continue;
    }
    if (c === ';') puntoYComa++;
    else if (c === ',') coma++;
    if (c.trim() !== '') hayContenido = true;
  }
  return puntoYComa >= coma ? ';' : ',';
}

/**
 * Filas de celdas. Respeta comillas (un delimitador o un salto de línea dentro de comillas es parte
 * de la celda, `""` es una comilla literal), acepta `\r\n`/`\n`/`\r`, quita el BOM de UTF-8 y
 * descarta las filas sin ninguna celda con contenido. Una comilla sin cerrar toma hasta el final.
 */
export function leerCsv(texto: string, opciones: OpcionesCsv = {}): string[][] {
  const s = normalizar(texto);
  const delim = opciones.delimitador === 'auto' ? detectarDelimitador(s) : (opciones.delimitador ?? ',');
  const recortar = opciones.recortar === true;

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;

  const cerrarCelda = () => { fila.push(recortar ? celda.trim() : celda); celda = ''; };
  const cerrarFila = () => {
    cerrarCelda();
    if (fila.some((c) => c.trim() !== '')) filas.push(fila);
    fila = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (enComillas && s[i + 1] === '"') { celda += '"'; i++; }
      else enComillas = !enComillas;
    } else if (enComillas) {
      celda += c;
    } else if (c === delim) {
      cerrarCelda();
    } else if (c === '\n') {
      cerrarFila();
    } else {
      celda += c;
    }
  }
  // Último registro si el texto no termina en salto de línea.
  if (celda !== '' || fila.length > 0) cerrarFila();
  return filas;
}
