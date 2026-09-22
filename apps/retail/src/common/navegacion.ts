import { crearNavegacion } from '@ferreteria/shared';

// Rutas de Retail que pueden ser pantalla de inicio o favorito (ADR-080). Cada `permiso` debe
// existir en PERMISOS (src/main/auth/seed.ts).
export const navegacionRetail = crearNavegacion({
  rutas: [
    { path: '/pos' },
    { path: '/presupuestos', permiso: 'presupuesto.crear' },
    { path: '/remitos', permiso: 'remito.crear' },
    { path: '/caja', permiso: 'caja.operar' },
    { path: '/productos', permiso: 'producto.consultar' },
    { path: '/stock', permiso: 'stock.entrada' },
    { path: '/etiquetas' },
    { path: '/compras/proveedores', permiso: 'proveedor.gestionar' },
    { path: '/compras/ordenes', permiso: 'compra.recibir' },
    { path: '/clientes', permiso: 'ctacte.cobrar' },
    { path: '/credito', permiso: 'ctacte.cobrar' },
    { path: '/dashboard', permiso: 'dashboard.ver' },
    { path: '/reportes/ventas', permiso: 'dashboard.ver' },
  ],
  inicioPorRol: { SUPERVISOR: '/dashboard', OPERADOR: '/pos' },
  // Piso incondicional: /productos no tiene guard de permiso a nivel de ruta.
  inicioFallback: '/productos',
});
