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

// Centralized route tree. Routes are never defined inline in components.
// E1: solo pantallas del core (sin renderVentaDetalle en CajaView — llega en E3; sin
// cargarListasPrecio en ClienteForm/ClienteDetalle — llega en E4).
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
      { path: 'caja', element: <CajaView /> },
      { path: 'caja/cerrar', element: <CajaCierreView /> },
      { path: 'clientes', element: <ClientesListado /> },
      { path: 'clientes/nuevo', element: <ClienteForm /> },
      { path: 'clientes/:id', element: <ClienteDetalle /> },
      { path: 'clientes/:id/editar', element: <ClienteForm /> },
      { path: 'credito', element: <CtaCteListado /> },
      { path: 'credito/:clienteId', element: <CtaCteDetalle /> },
      { path: 'config/mi-cuenta', element: <ConfigMiCuenta /> },
      { path: 'config/usuarios', element: <ConfigUsuarios /> },
      { path: 'config/roles-permisos', element: <RolesPermisosView /> },
      { path: 'config/backup-restore', element: <ConfigBackupRestore /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
