import { crearNavegacion } from '@ferreteria/shared';

export const navegacionElaborados = crearNavegacion({
  rutas: [
    { path: '/pos', permiso: 'venta.crear' },
    { path: '/caja', permiso: 'caja.operar' },
    { path: '/clientes', permiso: 'ctacte.cobrar' },
    { path: '/credito', permiso: 'ctacte.cobrar' },
  ],
  inicioPorRol: { SUPERVISOR: '/pos', OPERADOR: '/pos' },
  inicioFallback: '/pos',
});
