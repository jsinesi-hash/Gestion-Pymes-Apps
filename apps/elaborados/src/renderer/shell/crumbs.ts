import type { Seccion } from '@core/ui';

export const CRUMBS_ELABORADOS: Seccion[] = [
  { grupo: 'Caja', base: '/caja', baseLabel: 'Caja' },
  { grupo: 'Clientes', base: '/clientes', baseLabel: 'Clientes' },
  { grupo: 'Clientes', base: '/credito', baseLabel: 'Cuentas corrientes' },
  { grupo: 'Stock', base: '/stock/articulos', baseLabel: 'Artículos' },
  { grupo: 'Stock', base: '/stock/conteo', baseLabel: 'Conteo' },
  { grupo: 'Producción', base: '/produccion', baseLabel: 'Producción' },
  { grupo: 'Sistema', base: '/config/mi-cuenta', baseLabel: 'Mi cuenta' },
  { grupo: 'Sistema', base: '/config/usuarios', baseLabel: 'Usuarios' },
  { grupo: 'Sistema', base: '/config/roles-permisos', baseLabel: 'Roles y permisos' },
  { grupo: 'Sistema', base: '/config/backup-restore', baseLabel: 'Backup/Restore' },
];
