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
export { default as ProtectedRoute } from './auth/ProtectedRoute';
// Shell (B3)
export * from './shell/PantallaBloqueo';
export * from './shell/AppearanceDrawer';
export * from './shell/InicioRedirect';
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
