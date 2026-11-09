export type PermisoDef = { readonly codigo: string; readonly modulo: string };

// Permisos universales (toda app de familia los tiene). Cada app suma los suyos vía runSeed.
export const PERMISOS_CORE: readonly PermisoDef[] = [
  { codigo: 'venta.crear',         modulo: 'ventas' },
  { codigo: 'venta.anular',        modulo: 'ventas' },
  { codigo: 'precio.override',     modulo: 'ventas' },
  { codigo: 'caja.operar',         modulo: 'caja' },
  { codigo: 'ctacte.cobrar',       modulo: 'cuentas' },
  { codigo: 'dashboard.ver',       modulo: 'reportes' },
  { codigo: 'usuario.administrar', modulo: 'admin' },
  { codigo: 'config.fiscal',       modulo: 'admin' },
  { codigo: 'backup.crear',        modulo: 'admin' },
  { codigo: 'backup.restaurar',    modulo: 'admin' },
  { codigo: 'export.basico',       modulo: 'export' },
  { codigo: 'export.supervisor',   modulo: 'export' },
  { codigo: 'proveedor.gestionar', modulo: 'compras' },
  // ADR-146: permisos con significado propio. Solo Supervisor (no van a OPERADOR_PERMISOS_CORE).
  { codigo: 'cliente.baja',              modulo: 'cuentas' },
  { codigo: 'caja.autorizar_diferencia', modulo: 'caja' },
  { codigo: 'ctacte.autorizar_exceso',   modulo: 'cuentas' },
];

export const OPERADOR_PERMISOS_CORE: readonly string[] = [
  'venta.crear', 'caja.operar', 'ctacte.cobrar', 'export.basico',
];
