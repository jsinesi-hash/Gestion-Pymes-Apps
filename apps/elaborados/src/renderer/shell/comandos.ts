import type { Comando } from '@core/ui';

export const COMANDOS_ACCION: Comando[] = [
  { label: 'Abrir caja', to: '/caja', permiso: 'caja.operar' },
  { label: 'Nuevo cliente', to: '/clientes/nuevo', permiso: 'ctacte.cobrar' },
];

export const COMANDOS_NAV: Comando[] = [
  { label: 'Caja', to: '/caja', permiso: 'caja.operar' },
  { label: 'Clientes', to: '/clientes', permiso: 'ctacte.cobrar' },
  { label: 'Cuentas corrientes', to: '/credito', permiso: 'ctacte.cobrar' },
];
