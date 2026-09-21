import { useMemo } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ImportacionCostoWizardProvider } from './context/ImportacionCostoWizardContext';
import { ToastProvider } from './components/toast/ToastProvider';
import { routes } from './routes';

export default function App() {
  // createMemoryRouter is correct for Electron: doesn't depend on browser URL.
  // Memoized to prevent re-creating the router on every render, which would
  // break navigation state. Each test gets a fresh instance via a new component.
  const router = useMemo(() => createMemoryRouter(routes), []);
  return (
    <AuthProvider>
      {/* ERR-1 (ADR-077): feedback central por encima del router, así los toasts están
          disponibles en todas las rutas (incluido Login) y sobreviven la navegación del
          memory router. */}
      <ToastProvider>
        {/* Por encima del router: el wizard de Importar Costos sobrevive navegar a otra
            pantalla y volver (followup ADR-051) — ver ImportacionCostoWizardContext. */}
        <ImportacionCostoWizardProvider>
          <RouterProvider router={router} />
        </ImportacionCostoWizardProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
