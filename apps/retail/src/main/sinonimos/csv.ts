import { leerCsv } from '@ferreteria/shared';
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

const splitLista = (s: string): string[] =>
  (s ?? '').split('|').map(x => x.trim()).filter(x => x.length > 0);

export function parsearCsvSinonimos(texto: string): ParseoCsv {
  const errores: string[] = [];
  const filas = leerCsv(texto).filter(f => f.some(c => c.trim().length > 0)); // saltea líneas vacías
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
