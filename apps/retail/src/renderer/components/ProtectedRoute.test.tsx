import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type SessionData } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

const mockSession: SessionData = {
  id: 'u1',
  nombreCompleto: 'Admin',
  rolId: 'r1',
  rolNombre: '',
  permisos: [],
  preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
};

function renderWithAuth(session: SessionData | null) {
  return render(
    <AuthContext.Provider value={{ session, can: () => false, login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {} }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Pantalla Login</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Contenido Protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProtectedRoute', () => {
  it('sin sesión redirige a /login', () => {
    renderWithAuth(null);
    expect(screen.getByText('Pantalla Login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido Protegido')).not.toBeInTheDocument();
  });

  it('con sesión renderiza children', () => {
    renderWithAuth(mockSession);
    expect(screen.getByText('Contenido Protegido')).toBeInTheDocument();
    expect(screen.queryByText('Pantalla Login')).not.toBeInTheDocument();
  });
});
