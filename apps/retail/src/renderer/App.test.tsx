import { render, screen, waitFor, act, within } from '@testing-library/react';
import type { SessionData } from './context/AuthContext';
import App from './App';

const mockSession: SessionData = {
  id: 'u1',
  nombreCompleto: 'Admin',
  rolId: 'r1',
  rolNombre: '',
  permisos: [],
  preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
};

describe('App', () => {
  afterEach(() => {
    delete (window as any).ferreteria;
  });

  it('sin sesión muestra la pantalla de login', async () => {
    (window as any).ferreteria = {
      auth: { whoami: async () => null },
    };
    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Usuario')).toBeInTheDocument();
    });
  });

  it('con sesión muestra AppShell', async () => {
    (window as any).ferreteria = {
      auth: { whoami: async () => mockSession },
      catalogo: {
        producto: { list: async () => ({ items: [], total: 0 }) },
        categoria: { list: async () => [] },
        marca: { list: async () => [] },
        impuesto: { list: async () => [] },
        ubicacion: { list: async () => [] },
        preferencias: { get: async () => null },
      },
    };
    await act(async () => { render(<App />); });
    await waitFor(() => {
      // NAV-1 (ADR-077) agregó un segundo landmark de navegación (el breadcrumb): se
      // apunta al sidebar por su aria-label para desambiguar.
      const nav = screen.getByRole('navigation', { name: /menú principal/i });
      expect(within(nav).getByText('Productos')).toBeInTheDocument();
    });
  });
});
