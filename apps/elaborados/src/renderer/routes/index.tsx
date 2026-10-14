import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import {
  Login,
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
import { CategoriasVentaView } from '../views/carta/CategoriasVentaView';
import { ModificadoresView } from '../views/carta/ModificadoresView';
import { ProductosVentaView } from '../views/carta/ProductosVentaView';
import { PosView } from '../views/pos/PosView';
import { VentaDetalleModal } from '../views/caja/VentaDetalleModal';

// Centralized route tree. Routes are never defined inline in components.
// Pantallas del core + propias de Elaborados. CajaView recibe renderVentaDetalle (E3);
// sin cargarListasPrecio en ClienteForm/ClienteDetalle — llega en E4.
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
      { path: 'clientes/nuevo', element: <ClienteForm /> },
      { path: 'clientes/:id', element: <ClienteDetalle /> },
      { path: 'clientes/:id/editar', element: <ClienteForm /> },
      { path: 'credito', element: <CtaCteListado /> },
      { path: 'credito/:clienteId', element: <CtaCteDetalle /> },
      { path: 'stock/articulos', element: <ArticulosView /> },
      { path: 'stock/conteo', element: <ConteoView /> },
      { path: 'produccion', element: <ProduccionView /> },
      { path: 'compras', element: <ComprasView /> },
      { path: 'carta/categorias', element: <CategoriasVentaView /> },
      { path: 'carta/modificadores', element: <ModificadoresView /> },
      { path: 'carta/productos', element: <ProductosVentaView /> },
      { path: 'config/mi-cuenta', element: <ConfigMiCuenta /> },
      { path: 'config/usuarios', element: <ConfigUsuarios /> },
      { path: 'config/roles-permisos', element: <RolesPermisosView /> },
      { path: 'config/backup-restore', element: <ConfigBackupRestore /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
