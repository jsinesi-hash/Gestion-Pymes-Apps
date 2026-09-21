export type UbicacionCanonica = {
  sector: string;
  estante: string;
  posicion: string;
  codigo: string;
};

function canonSegmento(seg: string): string {
  const t = seg.trim().toUpperCase();
  if (/^\d+$/.test(t)) {
    const min = t.replace(/^0+/, '');
    return min === '' ? '0' : min;
  }
  return t;
}

/**
 * Forma canónica de una ubicación (ADR-064). Única fuente de la regla:
 * trim -> mayúsculas -> sacar ceros a la izquierda SOLO en segmentos all-dígitos
 * ('01' -> '1', '007' -> '7', '0' -> '0'). Sin padding a ancho fijo.
 * Un segmento no numérico (ej. 'EXT') sólo se trimea y pasa a mayúsculas.
 */
export function canonicalizarUbicacion(
  sector: string,
  estante: string,
  posicion: string,
): UbicacionCanonica {
  const s = canonSegmento(sector);
  const e = canonSegmento(estante);
  const p = canonSegmento(posicion);
  return { sector: s, estante: e, posicion: p, codigo: `${s}-${e}-${p}` };
}

/**
 * Canonicaliza un código de ubicación ya formado ('A-01-03' -> 'A-1-3',
 * 'a-1-3' -> 'A-1-3'). Aplica la misma regla por segmento que
 * `canonicalizarUbicacion`, partiendo el código por '-'. Sirve para matchear un
 * código de texto libre (ej. import de productos) contra ubicaciones guardadas,
 * incluidas las legacy que quedaron con ceros a la izquierda antes de ADR-064.
 */
export function canonicalizarCodigoUbicacion(codigo: string): string {
  return codigo.split('-').map(canonSegmento).join('-');
}
