import type { RouteObject } from 'react-router-dom';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login, ProtectedRoute, InicioRedirect, bridge } from '@core/ui';
import {
  CajaView,
  CajaCierreView,
  ConfigMiCuenta,
  ConfigUsuarios,
  RolesPermisosView,
  ConfigBackupRestore,
  CtaCteListado,
  CtaCteDetalle,
  ClientesListado,
  ClienteDetalle,
  ClienteForm,
} from '@core/ui';
import { VentaDetalleModal } from '../views/caja/VentaDetalleModal';
import { RetailShell } from '../views/shell/RetailShell';
import { PosSessionProvider } from '../context/PosSessionContext';
import { PosView } from '../views/pos/PosView';
import { ListasPreciosView } from '../views/config/ListasPreciosView';
import { ConfigSmtp } from '../views/config/ConfigSmtp';
import { ConfigDatosDemo } from '../views/config/ConfigDatosDemo';
import { ConfigSinonimos } from '../views/config/ConfigSinonimos';
import { FuncionalidadesView } from '../views/config/FuncionalidadesView';
import { CategoriasView } from '../views/config/CategoriasView';
import { MarcasView } from '../views/config/MarcasView';
import { ProductosListado } from '../views/productos/ProductosListado';
import { ProductoDetalle } from '../views/productos/ProductoDetalle';
import { ProductoForm } from '../views/productos/ProductoForm';
import { StockListado } from '../views/stock/StockListado';
import { Kardex } from '../views/stock/Kardex';
import { CatalogoProvider } from '../context/CatalogoContext';
import { ImportarView } from '../views/importar/ImportarView';
import { DashboardView } from '../views/dashboard/DashboardView';
import { ProveedoresListado } from '../views/compras/proveedores/ProveedoresListado';
import { ProveedorDetalle } from '../views/compras/proveedores/ProveedorDetalle';
import { ProveedorForm } from '../views/compras/proveedores/ProveedorForm';
import { OrdenesCompraListado } from '../views/compras/ordenes/OrdenesCompraListado';
import { OrdenCompraDetalle } from '../views/compras/ordenes/OrdenCompraDetalle';
import { NuevaOcForm } from '../views/compras/ordenes/NuevaOcForm';
import { OcSugeridaView } from '../views/compras/ordenes/OcSugeridaView';
import { RecepcionView } from '../views/compras/recepciones/RecepcionView';
import { ImportarCostosView } from '../views/precios/ImportarCostosView';
import { ImportarCatalogoProveedorView } from '../views/precios/ImportarCatalogoProveedorView';
import { RevisionHistorialView } from '../views/precios/RevisionHistorialView';
import { LotesPreciosView } from '../views/precios/LotesPreciosView';
import { LoteDetalleView } from '../views/precios/LoteDetalleView';
import { PreciosHub } from '../views/precios/PreciosHub';
import { EtiquetasView } from '../views/etiquetas/EtiquetasView';
import { ReporteVentasView } from '../views/reportes/ReporteVentasView';
import { UnidadesView } from '../views/config/UnidadesView';
import { UbicacionesView } from '../views/config/UbicacionesView';
import { RemitosView } from '../views/remitos/RemitosView';
import { TransportistasListado } from '../views/remitos/transportistas/TransportistasListado';
import { TransportistaForm } from '../views/remitos/transportistas/TransportistaForm';
import { PresupuestosView } from '../views/presupuestos/PresupuestosView';
import { AgendaEventosView } from '../views/agenda/AgendaEventosView';
import { BandejaAvisosView } from '../views/agenda/BandejaAvisosView';
import { RutinasView } from '../views/agenda/RutinasView';

// Seam B6: las listas de precios son de Retail; el core recibe sólo el catálogo a mostrar.
const cargarListasRetail = () =>
  bridge().precios.lista.list().then((rows: { id: string; nombre: string; activo: boolean }[]) =>
    rows.filter((r) => r.activo),
  );

// Centralized route tree. Routes are never defined inline in components.
export const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        {/* ADR-056 Lote 1: el cart vive en este provider, montado por encima de AppShell
            (que no se desmonta al navegar). Así la "venta en curso" persiste al cambiar de
            opción de menú y volver a /pos, sin tocar la BD. */}
        <PosSessionProvider>
          <RetailShell />
        </PosSessionProvider>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <InicioRedirect /> },
      { path: 'productos', element: <CatalogoProvider><ProductosListado /></CatalogoProvider> },
      { path: 'productos/nuevo', element: <ProductoForm /> },
      { path: 'productos/:id', element: <ProductoDetalle /> },
      { path: 'productos/:id/editar', element: <ProductoForm /> },
      { path: 'etiquetas', element: <EtiquetasView /> },
      { path: 'stock', element: <StockListado /> },
      { path: 'stock/:id/kardex', element: <Kardex /> },
      { path: 'pos', element: <PosView /> },
      { path: 'caja', element: <CajaView renderVentaDetalle={(id, onClose) => <VentaDetalleModal ventaId={id} onClose={onClose} onAnulada={onClose} />} /> },
      { path: 'caja/cerrar', element: <CajaCierreView /> },
      { path: 'dashboard', element: <DashboardView /> },
      { path: 'reportes/ventas', element: <ReporteVentasView /> },
      { path: 'presupuestos', element: <PresupuestosView /> },
      { path: 'agenda', element: <AgendaEventosView /> },
      { path: 'agenda/avisos', element: <BandejaAvisosView /> },
      { path: 'agenda/rutinas', element: <RutinasView /> },
      { path: 'remitos', element: <RemitosView /> },
      { path: 'remitos/transportistas', element: <TransportistasListado /> },
      { path: 'remitos/transportistas/nuevo', element: <TransportistaForm /> },
      { path: 'remitos/transportistas/:id/editar', element: <TransportistaForm /> },
      { path: 'importar', element: <ImportarView /> },
      { path: 'compras/proveedores', element: <ProveedoresListado /> },
      { path: 'compras/proveedores/nuevo', element: <ProveedorForm /> },
      { path: 'compras/proveedores/:id', element: <ProveedorDetalle /> },
      { path: 'compras/proveedores/:id/editar', element: <ProveedorForm /> },
      { path: 'compras/ordenes', element: <OrdenesCompraListado /> },
      { path: 'compras/ordenes/nueva', element: <NuevaOcForm /> },
      { path: 'compras/ordenes/sugerida', element: <OcSugeridaView /> },
      { path: 'compras/ordenes/:id', element: <OrdenCompraDetalle /> },
      { path: 'compras/ordenes/:ocId/recibir', element: <RecepcionView /> },
      { path: 'credito', element: <CtaCteListado /> },
      { path: 'credito/:clienteId', element: <CtaCteDetalle /> },
      { path: 'clientes', element: <ClientesListado /> },
      { path: 'clientes/nuevo', element: <ClienteForm cargarListasPrecio={cargarListasRetail} /> },
      { path: 'clientes/:id', element: <ClienteDetalle cargarListasPrecio={cargarListasRetail} /> },
      { path: 'clientes/:id/editar', element: <ClienteForm cargarListasPrecio={cargarListasRetail} /> },
      { path: 'config', element: <Navigate to="/config/mi-cuenta" replace /> },
      { path: 'config/mi-cuenta', element: <ConfigMiCuenta /> },
      { path: 'config/categorias', element: <CategoriasView /> },
      { path: 'config/marcas', element: <MarcasView /> },
      { path: 'config/unidades', element: <UnidadesView /> },
      { path: 'config/ubicaciones', element: <UbicacionesView /> },
      { path: 'config/listas-de-precios', element: <ListasPreciosView /> },
      { path: 'precios/importar-costos',      element: <ImportarCostosView /> },
      { path: 'precios/importar-catalogo-proveedor', element: <ImportarCatalogoProveedorView /> },
      { path: 'precios/revision-historial',   element: <RevisionHistorialView /> },
      { path: 'precios/lotes',                element: <LotesPreciosView /> },
      { path: 'precios/lotes/:id',            element: <LoteDetalleView /> },
      {
        path: 'precios/hub',
        element: <PreciosHub />,
        children: [
          { index: true, element: <Navigate to="/precios/hub/listas" replace /> },
          { path: 'listas', element: <ListasPreciosView /> },
          { path: 'lotes', element: <LotesPreciosView /> },
          // El detalle de lote vive DENTRO del hub para conservar las pestañas (ADR — igual
          // que el resto del módulo). La navegación a esta ruta es relativa/consciente del
          // contexto para funcionar también en el montaje plano `precios/lotes/:id`.
          { path: 'lotes/:id', element: <LoteDetalleView /> },
          { path: 'importar', element: <ImportarCostosView /> },
          { path: 'importar/catalogo-proveedor', element: <ImportarCatalogoProveedorView /> },
          { path: 'revision', element: <RevisionHistorialView /> },
        ],
      },
      { path: 'config/usuarios', element: <ConfigUsuarios /> },
      { path: 'config/roles-permisos', element: <RolesPermisosView /> },
      { path: 'config/funcionalidades', element: <FuncionalidadesView /> },
      { path: 'config/smtp', element: <ConfigSmtp /> },
      { path: 'config/backup-restore', element: <ConfigBackupRestore /> },
      { path: 'config/datos-demo', element: <ConfigDatosDemo /> },
      { path: 'config/sinonimos', element: <ConfigSinonimos /> },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
