export type Comando = { label: string; to: string; permiso?: string; hint?: string };

// Acciones rápidas (crear/abrir). Cada una con el permiso que la habilita (ver seed.ts).
export const COMANDOS_ACCION: Comando[] = [
  { label: 'Nuevo producto',    to: '/productos/nuevo', permiso: 'producto.crear' },
  { label: 'Nueva venta (POS)', to: '/pos',             permiso: 'venta.crear' },
  { label: 'Abrir caja',        to: '/caja',            permiso: 'caja.operar' },
  { label: 'Nuevo cliente',     to: '/clientes/nuevo',  permiso: 'ctacte.cobrar' },
  { label: 'Nuevo proveedor',   to: '/compras/proveedores/nuevo', permiso: 'proveedor.gestionar' },
];

// Navegación a pantallas principales. Filtradas por permiso en la paleta.
export const COMANDOS_NAV: Comando[] = [
  { label: 'Productos',         to: '/productos',            permiso: 'producto.consultar' },
  { label: 'Stock',             to: '/stock',                permiso: 'producto.consultar' },
  { label: 'Caja',              to: '/caja',                 permiso: 'caja.operar' },
  { label: 'POS',               to: '/pos',                  permiso: 'venta.crear' },
  { label: 'Clientes',          to: '/clientes',             permiso: 'ctacte.cobrar' },
  { label: 'Cuentas corrientes',to: '/credito',             permiso: 'ctacte.cobrar' },
  { label: 'Proveedores',       to: '/compras/proveedores',  permiso: 'proveedor.gestionar' },
  { label: 'Órdenes de compra', to: '/compras/ordenes',      permiso: 'compra.recibir' },
  { label: 'Dashboard',         to: '/dashboard',            permiso: 'dashboard.ver' },
  { label: 'Etiquetas',         to: '/etiquetas' },
];

// Normaliza para comparación: quita acentos y baja a minúsculas.
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function filtrarPorTexto<T extends { label: string }>(items: T[], texto: string): T[] {
  const q = norm(texto.trim());
  if (!q) return items;
  return items.filter(i => norm(i.label).includes(q));
}
