import type { PerfilEtiqueta, EtiquetaItem, CeldaLayout } from './types.js';

export function generarLayoutHoja(
  perfil: PerfilEtiqueta,
  items: EtiquetaItem[],
  celdaInicio: number,
): CeldaLayout[] {
  if (perfil.tipo === 'rollo') {
    return items.map((item, i) => ({
      pagina: i,
      x_mm: 0,
      y_mm: 0,
      ancho_mm: perfil.ancho_mm,
      alto_mm: perfil.alto_mm,
      item,
    }));
  }

  const cols   = perfil.cols      ?? 1;
  const filas  = perfil.filas     ?? 1;
  const margen = perfil.margen_mm ?? 0;
  const gap    = perfil.gap_mm    ?? 0;
  const total  = cols * filas;

  const celdaAncho = (perfil.ancho_mm - 2 * margen - (cols  - 1) * gap) / cols;
  const celdaAlto  = (perfil.alto_mm  - 2 * margen - (filas - 1) * gap) / filas;

  return items.map((item, i) => {
    const slot      = i + celdaInicio;
    const pagina    = Math.floor(slot / total);
    const slotEnPag = slot % total;
    const col       = slotEnPag % cols;
    const row       = Math.floor(slotEnPag / cols);
    return {
      pagina,
      x_mm:     margen + col * (celdaAncho + gap),
      y_mm:     margen + row * (celdaAlto  + gap),
      ancho_mm: celdaAncho,
      alto_mm:  celdaAlto,
      item,
    };
  });
}
