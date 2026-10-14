import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import {
  Login,
  bridge,
  ProtectedRoute,
  InicioRedirect,
  CajaView,
  CajaCierreView,
  ClientesListado,
  ClienteDetalle,
  ClienteForm,
  CtaCteListado,
  CtaCteDetalle,
  ConfigMiCuenta,
  ConfigUsuarios,
  RolesPermisosView,
  ConfigBackupRestore,
} from '@core/ui';
import { ElaboradosShell } from '../shell/ElaboradosShell';
import { ArticulosView } from '../views/stock/ArticulosView';
import { ConteoView } from '../views/stock/ConteoView';
import { ProduccionView } from '../views/produccion/ProduccionView';
import { ComprasView } from '../views/compras/ComprasView';
import { ProveedoresView } from '../views/compras/ProveedoresView';
import { ReportesView } from '../views/reportes/ReportesView';
import { CategoriasVentaView } from '../views/carta/CategoriasVentaView';
import { ModificadoresView } from '../views/carta/ModificadoresView';
import { ProductosVentaView } from '../views/carta/ProductosVentaView';
import { ListasPrecioView } from '../views/carta/ListasPrecioView';
import { PosView } from '../views/pos/PosView';
import { VentaDetalleModal } from '../views/caja/VentaDetalleModal';

// Centralized route tree. Routes are never defined inline in components.
// Pantallas del core + propias de Elaborados. CajaView recibe renderVentaDetalle (E3);
// ClienteForm/ClienteDetalle reciben las listas de precio activas (ADR-104).
// Seam B6: las listas son datos de la app; el core recibe sólo el catálogo a mostrar.
const cargarListas = () =>
  (bridge() as any).listaPrecio.list().then((rows: { id: string; nombre: string; activo: boolean }[]) =>
    rows.filter((r) => r.activo),
  );

export const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <ElaboradosShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <InicioRedirect /> },
      { path: 'pos', element: <PosView /> },
      { path: 'caja', element: <CajaView renderVentaDetalle={(id, onClose) => <VentaDetalleModal ventaId={id} onClose={onClose} />} /> },
      { path: 'caja/cerrar', element: <CajaCierreView /> },
      { path: 'clientes', element: <ClientesListado /> },
      { path: 'clientes/nuevo', element: <ClienteForm cargarListasPrecio={cargarListas} /> },
      { path: 'clientes/:id', element: <ClienteDetalle cargarListasPrecio={cargarListas} /> },
      { path: 'clientes/:id/editar', element: <ClienteForm cargarListasPrecio={cargarListas} /> },
      { path: 'credito', element: <CtaCteListado /> },
      { path: 'credito/:clienteId', element: <CtaCteDetalle /> },
      { path: 'stock/articulos', element: <ArticulosView /> },
      { path: 'stock/conteo', element: <ConteoView /> },
      { path: 'produccion', element: <ProduccionView /> },
      { path: 'compras', element: <ComprasView /> },
      { path: 'compras/proveedores', element: <ProveedoresView /> },
      { path: 'reportes', element: <ReportesView /> },
      { path: 'carta/categorias', element: <CategoriasVentaView /> },
      { path: 'carta/modificadores', element: <ModificadoresView /> },
      { path: 'carta/productos', element: <ProductosVentaView /> },
      { path: 'carta/listas-precio', element: <ListasPrecioView /> },
      { path: 'config/mi-cuenta', element: <ConfigMiCuenta /> },
      { path: 'config/usuarios', element: <ConfigUsuarios /> },
      { path: 'config/roles-permisos', element: <RolesPermisosView /> },
      { path: 'config/backup-restore', element: <ConfigBackupRestore /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
