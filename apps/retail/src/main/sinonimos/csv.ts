import type { SinonimoGrupo } from './dataset';
import { COLUMNAS_CSV_SINONIMOS } from './validar';

// ADR-067 — Parser del CSV de sinónimos. Formato:
//   canonico,sinonimos,abreviaturas,rubro,nota
// donde `sinonimos` y `abreviaturas` van separados por "|". Soporta comillas dobles
// (RFC-4180: campos entre "" que pueden contener comas; "" escapa una comilla). Lo usan
// tanto el dataset embebido (seed) como la importación CSV.

export type ParseoCsv = {
  grupos: SinonimoGrupo[];
  errores: string[]; // errores de formato a nivel archivo (encabezado, columnas)
};

// Tokeniza un texto CSV en filas de celdas, respetando comillas y saltos de línea internos.
function tokenizar(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let enComillas = false;
  const s = texto.replace(/\r\n?/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(celda); celda = '';
    } else if (c === '\n') {
      fila.push(celda); celda = '';
      filas.push(fila); fila = [];
    } else {
      celda += c;
    }
  }
  // última celda/fila si el archivo no termina en \n
  if (celda.length > 0 || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas;
}

const splitLista = (s: string): string[] =>
  (s ?? '').split('|').map(x => x.trim()).filter(x => x.length > 0);

export function parsearCsvSinonimos(texto: string): ParseoCsv {
  const errores: string[] = [];
  const filas = tokenizar(texto).filter(f => f.some(c => c.trim().length > 0)); // saltea líneas vacías
  if (filas.length === 0) return { grupos: [], errores: ['El archivo está vacío.'] };

  const encabezado = filas[0].map(c => c.trim().toLowerCase());
  const esperado = COLUMNAS_CSV_SINONIMOS.map(c => c.toLowerCase());
  const faltantes = esperado.filter(c => !encabezado.includes(c));
  if (faltantes.length > 0) {
    errores.push(`Faltan columnas en el encabezado: ${faltantes.join(', ')}. Esperado: ${COLUMNAS_CSV_SINONIMOS.join(', ')}.`);
    return { grupos: [], errores };
  }
  const col = (nombre: string) => encabezado.indexOf(nombre);
  const iCan = col('canonico'), iSin = col('sinonimos'), iAbr = col('abreviaturas'), iRub = col('rubro'), iNota = col('nota');

  const grupos: SinonimoGrupo[] = [];
  for (let r = 1; r < filas.length; r++) {
    const f = filas[r];
    const canonico = (f[iCan] ?? '').trim();
    if (!canonico) {
      errores.push(`Fila ${r + 1}: canónico vacío.`);
      continue;
    }
    const grupo: SinonimoGrupo = {
      canonico,
      sinonimos: splitLista(f[iSin] ?? ''),
      abreviaturas: splitLista(f[iAbr] ?? ''),
    };
    const rubro = (f[iRub] ?? '').trim();
    if (rubro) grupo.rubro = rubro;
    const nota = (f[iNota] ?? '').trim();
    if (nota) grupo.nota = nota;
    grupos.push(grupo);
  }
  return { grupos, errores };
}
