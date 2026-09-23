// NAV-1 (ADR-077): breadcrumb jerárquico derivado de la ruta. Función pura y testeable
// (sin React) que devuelve el rastro de migas: un crumb de grupo (contexto, sin link), la
// página de sección (link cuando estás en una sub-ruta), y el leaf de la sub-ruta actual.
// La lista lo renderiza en AppShell con <Link> para los que tienen `to`.
//
// Elaborados E1 (Task B4): el conjunto de secciones y las keywords de leaf ya NO viven acá.
// La función es genérica y recibe ambos por parámetro; cada app aporta los suyos
// (Retail: renderer/shell/crumbsRetail.ts). Acá solo queda la mecánica + un default de
// keywords genérico.

export type Crumb = { label: string; to?: string };

// Cada sección: su grupo del sidebar (contexto), la ruta base (página lista) y su etiqueta.
// El orden del arreglo no importa: buildBreadcrumb lo evalúa de base más larga a más corta
// para que la ruta más específica gane sobre su prefijo (p. ej. /remitos/transportistas vs
// /remitos).
export type Seccion = { grupo: string; base: string; baseLabel: string };

// Etiquetas de leaf genéricas: el último segmento de la sub-ruta que no matchea (id de
// entidad) cae a "Detalle". Cada app puede extenderlo con sus propias keywords.
export const LEAF_KEYWORDS_DEFAULT: Record<string, string> = {
  nuevo: 'Nuevo', nueva: 'Nueva', editar: 'Editar', cerrar: 'Cierre de caja',
};

function leafLabel(resto: string, leafKeywords: Record<string, string>): string {
  const segs = resto.split('/').filter(Boolean);
  const ultimo = segs[segs.length - 1] ?? '';
  return leafKeywords[ultimo] ?? 'Detalle';
}

/**
 * Construye el rastro de migas para una ruta. El último crumb (página actual) nunca lleva
 * `to`; los ancestros navegables sí. Una ruta desconocida devuelve un único crumb neutro.
 */
export function buildBreadcrumb(
  pathname: string,
  secciones: readonly Seccion[],
  leafKeywords: Record<string, string> = LEAF_KEYWORDS_DEFAULT,
): Crumb[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  // Ordenadas por base descendente: la más específica gana sobre su prefijo.
  const ordenadas = [...secciones].sort((a, b) => b.base.length - a.base.length);
  const seccion = ordenadas.find(
    s => path === s.base || path.startsWith(s.base + '/'),
  );
  if (!seccion) return [{ label: 'Inicio' }];

  const resto = path.slice(seccion.base.length); // '' si estás en la lista

  if (resto === '') {
    // Página lista: grupo (contexto) + página actual, ninguno navegable.
    return [{ label: seccion.grupo }, { label: seccion.baseLabel }];
  }
  // Sub-ruta: la lista pasa a ser link y agregamos el leaf actual.
  return [
    { label: seccion.grupo },
    { label: seccion.baseLabel, to: seccion.base },
    { label: leafLabel(resto, leafKeywords) },
  ];
}
