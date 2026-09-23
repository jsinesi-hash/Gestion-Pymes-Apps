// Elaborados E1 (Task B4): secciones de breadcrumb y keywords de leaf propias de Retail.
// La mecánica pura vive en renderer/lib/breadcrumb.ts; acá sólo la configuración de Retail
// que RetailShell le pasa al AppShell (props `crumbs` y `leafKeywords`).

import { LEAF_KEYWORDS_DEFAULT, type Seccion } from '../lib/breadcrumb';

// Secciones del breadcrumb de Retail (antes SECCIONES en lib/breadcrumb.ts).
export const CRUMBS_RETAIL: readonly Seccion[] = [
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

// Keywords de leaf: las genéricas + las propias de Retail (kardex, OC sugerida, recepción).
export const LEAF_KEYWORDS_RETAIL: Record<string, string> = {
  ...LEAF_KEYWORDS_DEFAULT,
  kardex: 'Kardex',
  sugerida: 'OC Sugerida',
  recibir: 'Recepción',
};
