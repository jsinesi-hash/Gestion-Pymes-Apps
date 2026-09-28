// E1: solo pantallas del core. E2+ suma Venta, Producción, Stock, Carta, Compras…
import type { NavGroup } from '@core/ui';

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={d} />
  </svg>
);

export const NAV_ELABORADOS: NavGroup[] = [
  {
    key: 'caja',
    label: 'Caja',
    icon: I('M2 5h20v14H2zM2 10h20'),
    standalone: true,
    items: [{ label: 'Caja', to: '/caja', icon: I('M2 5h20v14H2zM2 10h20') }],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    icon: I('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'),
    permiso: 'ctacte.cobrar',
    items: [
      { label: 'Clientes', to: '/clientes', icon: I('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'), permiso: 'ctacte.cobrar' },
      { label: 'Cuentas corrientes', to: '/credito', icon: I('M1 4h22v16H1zM1 10h22'), permiso: 'ctacte.cobrar' },
    ],
  },
  {
    key: 'stock',
    label: 'Stock',
    icon: I('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
    items: [
      { label: 'Artículos', to: '/stock/articulos', icon: I('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'), permiso: 'articulo.gestionar' },
      { label: 'Conteo', to: '/stock/conteo', icon: I('M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'), permiso: 'stock.ajustar' },
    ],
  },
  {
    key: 'produccion',
    label: 'Producción',
    icon: I('M3 3h18v18H3zM3 9h18M9 21V9'),
    standalone: true,
    permiso: 'produccion.registrar',
    items: [{ label: 'Producción', to: '/produccion', icon: I('M3 3h18v18H3zM3 9h18M9 21V9'), permiso: 'produccion.registrar' }],
  },
  {
    key: 'carta',
    label: 'Carta',
    icon: I('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z'),
    permiso: 'producto_venta.gestionar',
    items: [
      { label: 'Categorías', to: '/carta/categorias', icon: I('M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z'), permiso: 'producto_venta.gestionar' },
      { label: 'Modificadores', to: '/carta/modificadores', icon: I('M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z'), permiso: 'producto_venta.gestionar' },
      { label: 'Productos de venta', to: '/carta/productos', icon: I('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'), permiso: 'producto_venta.gestionar' },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: I('M12 15a3 3 0 100-6 3 3 0 000 6z'),
    items: [
      { label: 'Mi cuenta', to: '/config/mi-cuenta', icon: I('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2') },
      { label: 'Usuarios', to: '/config/usuarios', icon: I('M17 21v-2a4 4 0 00-4-4H5'), permiso: 'usuario.administrar' },
      { label: 'Roles y permisos', to: '/config/roles-permisos', icon: I('M17 21v-2a4 4 0 00-4-4H5'), permiso: 'usuario.administrar' },
      { label: 'Backup/Restore', to: '/config/backup-restore', icon: I('M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'), permiso: 'backup.crear' },
    ],
  },
];
