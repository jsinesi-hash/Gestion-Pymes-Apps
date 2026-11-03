// @core/ui — design system + primitivos de framework (renderer).
export * from './bridge';
export * from './AppProfile';
export * from './components/toast/ToastProvider';
export * from './components/toast/useToast';
export * from './components/PasswordInput';
export * from './components/SearchBox';
export * from './components/DireccionGeo';
export * from './hooks/useEscapeAction';
export * from './hooks/useEscapeToClose';
export * from './lib/rutearCampoError';
export * from './lib/resaltar';
export * from './lib/documento';
export * from './lib/format';
export * from './lib/credito';
export * from './hooks/useCallIpc';
export * from './hooks/useFormErrors';
export * from './hooks/usePersistentListState';
export * from './hooks/useIdleLock';
export * from './hooks/useBloqueoInactividad';
export * from './lib/errores';
// Auth + sesión (B3)
export * from './auth/AuthContext';
export { default as Login } from './auth/Login';
export { default as RecuperarPassword } from './auth/RecuperarPassword';
export { default as ProtectedRoute } from './auth/ProtectedRoute';
// Shell (B3)
export * from './shell/PantallaBloqueo';
export * from './shell/AppearanceDrawer';
export * from './shell/InicioRedirect';
// Shell genérico (B5)
export * from './shell/AppShell';
export * from './shell/CommandPalette';
export * from './shell/breadcrumb';
export * from './shell/comandos';
export * from './shell/DepuracionBackupsModal';
export * from './shell/buscadorClientes';
// Preferencias e inicio (B3)
export * from './hooks/usePreferencias';
export * from './hooks/useInicioPersonalizable';
// Vistos recientes (B2 diferido → B3)
export * from './hooks/useVistosRecientes';
export * from './components/VistosRecientesPanel';
export * from './components/VistosRecientemente';
// Export (B2 diferido → B3)
export * from './components/export/ExportarButton';
export * from './components/export/ExportarModal';
// Hooks de caja (B6)
export * from './hooks/useCajaActiva';
export * from './hooks/useCajaCierre';
// Vistas universales (B6)
export { ClientesListado } from './views/clientes/ClientesListado';
export { ClienteDetalle } from './views/clientes/ClienteDetalle';
export { ClienteForm } from './views/clientes/ClienteForm';
export { CtaCteListado } from './views/credito/CtaCteListado';
export { CtaCteDetalle } from './views/credito/CtaCteDetalle';
export { CtaCteResumenCard } from './views/credito/CtaCteResumenCard';
export { RegistrarCobroModal } from './views/credito/RegistrarCobroModal';
export { CajaView } from './views/caja/CajaView';
export { AperturaForm } from './views/caja/AperturaForm';
export { CajaDashboard } from './views/caja/CajaDashboard';
export { CajaCierreView } from './views/caja/CajaCierreView';
export { MovimientoModal } from './views/caja/MovimientoModal';
export { SupervisorAuthModal } from './views/caja/SupervisorAuthModal';
export { ConfigUsuarios } from './views/config/ConfigUsuarios';
export { ConfigMiCuenta } from './views/config/ConfigMiCuenta';
export { RolesPermisosView } from './views/config/RolesPermisosView';
export { ConfigBackupRestore } from './views/config/ConfigBackupRestore';
export { ErroresSistemaCard } from './views/config/ErroresSistemaCard';
export { RestoreWizard } from './views/config/RestoreWizard';
// Venta universal (E3c1)
export { TicketModal } from './views/venta/TicketModal';
export { buildTicketHtml, formatPesos, etiquetaMedio } from './views/venta/ticketHtml';
export { AnulacionModal } from './views/venta/AnulacionModal';
export { ConfirmarVentaModal } from './views/venta/ConfirmarVentaModal';
export type { MedioPago, VentaPagoPayload } from './views/venta/tipos';
export * from './components/ErrorBoundary';
export * from './components/Modal';
export * from './components/filaActivable';
