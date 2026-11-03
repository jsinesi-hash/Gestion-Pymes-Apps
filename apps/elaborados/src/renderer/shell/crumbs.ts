import type { Seccion } from '@core/ui';

export const CRUMBS_ELABORADOS: Seccion[] = [
  { grupo: 'Venta', base: '/pos', baseLabel: 'POS' },
  { grupo: 'Caja', base: '/caja', baseLabel: 'Caja' },
  { grupo: 'Clientes', base: '/clientes', baseLabel: 'Clientes' },
  { grupo: 'Clientes', base: '/credito', baseLabel: 'Cuentas corrientes' },
  { grupo: 'Stock', base: '/stock/articulos', baseLabel: 'Artículos' },
  { grupo: 'Stock', base: '/stock/conteo', baseLabel: 'Conteo' },
  { grupo: 'Producción', base: '/produccion', baseLabel: 'Producción' },
  { grupo: 'Compras', base: '/compras', baseLabel: 'Compras' },
  { grupo: 'Compras', base: '/compras/proveedores', baseLabel: 'Proveedores' },
  { grupo: 'Reportes', base: '/reportes', baseLabel: 'Reportes' },
  { grupo: 'Carta', base: '/carta/categorias', baseLabel: 'Categorías' },
  { grupo: 'Carta', base: '/carta/modificadores', baseLabel: 'Modificadores' },
  { grupo: 'Carta', base: '/carta/productos', baseLabel: 'Productos de venta' },
  { grupo: 'Carta', base: '/carta/listas-precio', baseLabel: 'Listas de precio' },
  { grupo: 'Sistema', base: '/config/mi-cuenta', baseLabel: 'Mi cuenta' },
  { grupo: 'Sistema', base: '/config/usuarios', baseLabel: 'Usuarios' },
  { grupo: 'Sistema', base: '/config/roles-permisos', baseLabel: 'Roles y permisos' },
  { grupo: 'Sistema', base: '/config/backup-restore', baseLabel: 'Backup/Restore' },
  { grupo: 'Sistema', base: '/config/datos-demo', baseLabel: 'Datos demo' },
  { grupo: 'Sistema', base: '/config/smtp', baseLabel: 'Email / SMTP' },
];
