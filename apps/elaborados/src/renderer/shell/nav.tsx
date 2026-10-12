// E1: solo pantallas del core. E2+ suma Venta, Producción, Stock, Carta, Compras…
import type { NavGroup } from '@core/ui';

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={d} />
  </svg>
);

// Íconos multi-trazo (círculos + paths): `I(d)` solo dibuja UN path y deja ícono truncado.
const S = (children: JSX.Element | JSX.Element[]) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{children}</svg>
);
const SVG_CLIENTES = S([<path key="a" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />, <circle key="b" cx="9" cy="7" r="4" />, <path key="c" d="M23 21v-2a4 4 0 00-3-3.87" />, <path key="d" d="M16 3.13a4 4 0 010 7.75" />]);
const SVG_MI_CUENTA = S([<path key="a" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />, <circle key="b" cx="12" cy="7" r="4" />]);
const SVG_SISTEMA = S(<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />);
const SVG_BACKUP = S([<ellipse key="a" cx="12" cy="5" rx="9" ry="3" />, <path key="b" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />, <path key="c" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />]);

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
    icon: SVG_CLIENTES,
    permiso: 'ctacte.cobrar',
    items: [
      { label: 'Clientes', to: '/clientes', icon: SVG_CLIENTES, permiso: 'ctacte.cobrar' },
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
    icon: SVG_SISTEMA,
    items: [
      { label: 'Mi cuenta', to: '/config/mi-cuenta', icon: SVG_MI_CUENTA },
      { label: 'Usuarios', to: '/config/usuarios', icon: SVG_CLIENTES, permiso: 'usuario.administrar' },
      { label: 'Roles y permisos', to: '/config/roles-permisos', icon: SVG_CLIENTES, permiso: 'usuario.administrar' },
      { label: 'Backup/Restore', to: '/config/backup-restore', icon: SVG_BACKUP, permiso: 'backup.crear' },
    ],
  },
];
