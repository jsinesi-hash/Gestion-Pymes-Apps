import { Fragment, type ReactNode } from 'react';

// Resaltado del match de búsqueda, insensible a acentos y mayúsculas, preservando el texto
// original (ADR-081 / SRCH-2). No se usa `normalizar()` de @ferreteria/shared porque ésa
// colapsa espacios y canoniza medidas → cambia la longitud y las posiciones, lo que
// impediría mapear el match de vuelta al texto original. Acá se pliega carácter por carácter
// (1:1 con los code points del original) para poder cortar el original en las mismas posiciones.

function plegarCaracter(c: string): string {
  const f = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Un único carácter representativo por code point del original, para mantener el mapeo 1:1.
  return f.length > 0 ? f[0] : c.toLowerCase();
}

/**
 * Devuelve el `texto` con cada aparición de `query` envuelta en `<mark>`.
 * El match ignora acentos y mayúsculas; el texto renderizado es siempre el original.
 */
export function resaltarCoincidencia(texto: string, query: string): ReactNode {
  const q = (query ?? '').trim();
  if (!q || !texto) return texto;

  const chars = Array.from(texto);
  const plegadoTexto = chars.map(plegarCaracter).join('');
  const plegadoQuery = Array.from(q).map(plegarCaracter).join('');
  if (!plegadoQuery) return texto;

  const partes: ReactNode[] = [];
  let cursor = 0;
  let desde = plegadoTexto.indexOf(plegadoQuery, 0);
  let key = 0;
  while (desde !== -1) {
    if (desde > cursor) {
      partes.push(<Fragment key={key++}>{chars.slice(cursor, desde).join('')}</Fragment>);
    }
    const hasta = desde + plegadoQuery.length;
    partes.push(<mark key={key++}>{chars.slice(desde, hasta).join('')}</mark>);
    cursor = hasta;
    desde = plegadoTexto.indexOf(plegadoQuery, hasta);
  }
  if (cursor < chars.length) {
    partes.push(<Fragment key={key++}>{chars.slice(cursor).join('')}</Fragment>);
  }
  return partes;
}
