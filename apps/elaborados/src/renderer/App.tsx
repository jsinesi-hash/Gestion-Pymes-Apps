import { useMemo } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider, AppProfileProvider, ToastProvider, ErrorBoundary } from '@core/ui';
import { navegacionElaborados } from '../common/navegacion';
import { routes } from './routes';

export default function App() {
  // createMemoryRouter is correct for Electron: doesn't depend on browser URL.
  // Memoized to prevent re-creating the router on every render, which would
  // break navigation state. Each test gets a fresh instance via a new component.
  const router = useMemo(() => createMemoryRouter(routes), []);
  return (
    // Revisión 2026-10-20 (P1): último recurso por encima de los providers y del router.
    <ErrorBoundary recargable>
    <AppProfileProvider value={{ nombreApp: 'Heladería', navegacion: navegacionElaborados }}>
      <AuthProvider>
        {/* ERR-1 (ADR-077): feedback central por encima del router, así los toasts están
            disponibles en todas las rutas (incluido Login) y sobreviven la navegación del
            memory router. */}
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </AppProfileProvider>
    </ErrorBoundary>
  );
}
