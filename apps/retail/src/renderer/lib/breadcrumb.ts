// NAV-1 (ADR-077): breadcrumb jerárquico derivado de la ruta. Función pura y testeable
// (sin React) que devuelve el rastro de migas: un crumb de grupo (contexto, sin link), la
// página de sección (link cuando estás en una sub-ruta), y el leaf de la sub-ruta actual.
// La lista lo renderiza en AppShell con <Link> para los que tienen `to`.

export type Crumb = { label: string; to?: string };

type Seccion = { grupo: string; base: string; baseLabel: string };

// Cada sección: su grupo del sidebar (contexto), la ruta base (página lista) y su etiqueta.
// El orden no importa: se evalúa de base más larga a más corta para que la ruta más
// específica gane sobre su prefijo (p. ej. /remitos/transportistas vs /remitos).
const SECCIONES: readonly Seccion[] = [
  // Punto de venta
  { grupo: 'Punto de venta', base: '/pos', baseLabel: 'POS' },
  { grupo: 'Punto de venta', base: '/presupuestos', baseLabel: 'Presupuestos' },
  // Facturación
  { grupo: 'Facturación', base: '/remitos/transportistas', baseLabel: 'Transportistas' },
  { grupo: 'Facturación', base: '/remitos', baseLabel: 'Remitos' },
  { grupo: 'Facturación', base: '/caja', baseLabel: 'Caja' },
  // Catálogo
  { grupo: 'Catálogo', base: '/productos', baseLabel: 'Productos' },
  { grupo: 'Catálogo', base: '/stock', baseLabel: 'Stock' },
  // Abastecimiento
  { grupo: 'Abastecimiento', base: '/compras/proveedores', baseLabel: 'Proveedores' },
  { grupo: 'Abastecimiento', base: '/compras/ordenes', baseLabel: 'Órdenes de compra' },
  // Clientes
  { grupo: 'Clientes', base: '/clientes', baseLabel: 'Clientes' },
  { grupo: 'Clientes', base: '/credito', baseLabel: 'Cuentas corrientes' },
  // Reportes
  { grupo: 'Reportes', base: '/reportes/ventas', baseLabel: 'Reporte de Ventas' },
  { grupo: 'Reportes', base: '/dashboard', baseLabel: 'Dashboard' },
  // Agenda
  { grupo: 'Agenda', base: '/agenda/avisos', baseLabel: 'Bandeja de avisos' },
  { grupo: 'Agenda', base: '/agenda/rutinas', baseLabel: 'Rutinas' },
  { grupo: 'Agenda', base: '/agenda', baseLabel: 'Agenda' },
  // Precios / Costos
  { grupo: 'Precios / Costos', base: '/config/listas-de-precios', baseLabel: 'Listas de precios' },
  { grupo: 'Precios / Costos', base: '/precios/importar-catalogo-proveedor', baseLabel: 'Importar Catálogo del Proveedor' },
  { grupo: 'Precios / Costos', base: '/precios/importar-costos', baseLabel: 'Importar costos' },
  { grupo: 'Precios / Costos', base: '/precios/revision-historial', baseLabel: 'Revisión de Costos y Catálogo' },
  { grupo: 'Precios / Costos', base: '/precios/lotes', baseLabel: 'Lotes de precios' },
  // Precios y Costos (hub, ADR-078)
  { grupo: 'Precios y Costos', base: '/precios/hub/importar/catalogo-proveedor', baseLabel: 'Importar · Catálogo del Proveedor' },
  { grupo: 'Precios y Costos', base: '/precios/hub/listas',   baseLabel: 'Listas' },
  { grupo: 'Precios y Costos', base: '/precios/hub/lotes',    baseLabel: 'Lotes' },
  { grupo: 'Precios y Costos', base: '/precios/hub/importar', baseLabel: 'Importar' },
  { grupo: 'Precios y Costos', base: '/precios/hub/revision', baseLabel: 'Revisión' },
  { grupo: 'Precios y Costos', base: '/precios/hub',          baseLabel: 'Precios y Costos' },
  // Configuración
  { grupo: 'Configuración', base: '/etiquetas', baseLabel: 'Etiquetas' },
  { grupo: 'Configuración', base: '/config/categorias', baseLabel: 'Categorías' },
  { grupo: 'Configuración', base: '/config/marcas', baseLabel: 'Marcas' },
  { grupo: 'Configuración', base: '/config/unidades', baseLabel: 'Unidades' },
  { grupo: 'Configuración', base: '/config/ubicaciones', baseLabel: 'Ubicaciones' },
  { grupo: 'Configuración', base: '/config/sinonimos', baseLabel: 'Sinónimos' },
  { grupo: 'Configuración', base: '/importar', baseLabel: 'Importar datos' },
  // Sistema
  { grupo: 'Sistema', base: '/config/mi-cuenta', baseLabel: 'Mi cuenta' },
  { grupo: 'Sistema', base: '/config/usuarios', baseLabel: 'Usuarios' },
  { grupo: 'Sistema', base: '/config/roles-permisos', baseLabel: 'Roles y permisos' },
  { grupo: 'Sistema', base: '/config/funcionalidades', baseLabel: 'Funcionalidades' },
  { grupo: 'Sistema', base: '/config/backup-restore', baseLabel: 'Backup/Restore' },
  { grupo: 'Sistema', base: '/config/smtp', baseLabel: 'Email / SMTP' },
  { grupo: 'Sistema', base: '/config/datos-demo', baseLabel: 'Datos demo' },
];

// Ordenadas por base descendente: la más específica gana sobre su prefijo.
const SECCIONES_ORDENADAS = [...SECCIONES].sort((a, b) => b.base.length - a.base.length);

// Etiqueta del leaf según el último segmento de la sub-ruta. Los que no matchean (id de
// entidad) caen a "Detalle".
const LEAF_KEYWORDS: Record<string, string> = {
  nuevo: 'Nuevo', nueva: 'Nueva', editar: 'Editar', kardex: 'Kardex',
  sugerida: 'OC Sugerida', recibir: 'Recepción', cerrar: 'Cierre de caja',
};

function leafLabel(resto: string): string {
  const segs = resto.split('/').filter(Boolean);
  const ultimo = segs[segs.length - 1] ?? '';
  return LEAF_KEYWORDS[ultimo] ?? 'Detalle';
}

/**
 * Construye el rastro de migas para una ruta. El último crumb (página actual) nunca lleva
 * `to`; los ancestros navegables sí. Una ruta desconocida devuelve un único crumb neutro.
 */
export function buildBreadcrumb(pathname: string): Crumb[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const seccion = SECCIONES_ORDENADAS.find(
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
    { label: leafLabel(resto) },
  ];
}
