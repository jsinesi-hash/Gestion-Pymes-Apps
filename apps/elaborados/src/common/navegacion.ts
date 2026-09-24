import { crearNavegacion } from '@ferreteria/shared';

export const navegacionElaborados = crearNavegacion({
  rutas: [
    { path: '/caja', permiso: 'caja.operar' },
    { path: '/clientes', permiso: 'ctacte.cobrar' },
    { path: '/credito', permiso: 'ctacte.cobrar' },
  ],
  inicioPorRol: { SUPERVISOR: '/caja', OPERADOR: '/caja' },
  inicioFallback: '/caja',
});
