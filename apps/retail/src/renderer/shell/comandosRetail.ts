// Elaborados E1 (Task B4): comandos y buscadores concretos de Retail para la CommandPalette.
// La mecánica (tipo Comando, filtrarPorTexto) vive en renderer/lib/comandos.ts; el componente
// CommandPalette los recibe por props desde RetailShell.

import { bridge, filtrarPorTexto, type Comando, type Buscador } from '@core/ui';

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

type ProveedorRow = {
  id: string;
  razon_social: string;
};

// Productos: búsqueda por IPC en cada consulta (la paleta ya la debounce ~200ms). Query
// vacía → sin resultados. Devuelve label = nombre_corto, hint = sku, to = /productos/:id.
export const buscadorProductos: Buscador = {
  key: 'productos',
  titulo: 'Productos',
  async buscar(q) {
    if (q.trim() === '') return [];
    const r = await Promise.resolve(
      bridge()?.catalogo?.producto?.list?.({
        busqueda: q, activo: true, page: 1, pageSize: 8,
      }),
    );
    return (r?.items ?? []).map((p: any) => ({
      label: p.nombre_corto, to: `/productos/${p.id}`, hint: p.sku,
    }));
  },
};

// Proveedores: mismo patrón que clientes, gateado por `proveedor.gestionar`.
let proveedoresCache: ProveedorRow[] | null = null;
export const buscadorProveedores: Buscador = {
  key: 'proveedores',
  titulo: 'Proveedores',
  permiso: 'proveedor.gestionar',
  async buscar(q) {
    if (q.trim() === '') return [];
    if (proveedoresCache === null) {
      try {
        proveedoresCache = (await Promise.resolve(bridge()?.compras?.proveedor?.list?.())) ?? [];
      } catch {
        proveedoresCache = [];
      }
    }
    return filtrarPorTexto(
      (proveedoresCache ?? []).map(p => ({ label: p.razon_social, to: `/compras/proveedores/${p.id}` })),
      q,
    );
  },
};
