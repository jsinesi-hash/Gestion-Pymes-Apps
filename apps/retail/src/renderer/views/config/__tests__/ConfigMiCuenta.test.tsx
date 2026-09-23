import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AppProfileProvider } from '@core/ui';
import { ConfigMiCuenta } from '@core/ui';
import { navegacionRetail } from '../../../../common/navegacion';

const mockWhoami = vi.fn();
const mockUpdate = vi.fn();
const mockChangePassword = vi.fn();

function buildAuth() {
  return {
    session: {
      id: 'u1',
      nombreCompleto: 'Juan Perez',
      rolId: 'r1',
      rolNombre: '',
      permisos: [],
      preferencias: {
        tema: 'claro' as const,
        acento: 'amber' as const,
        ui_font: 'Hanken Grotesk' as const,
        densidad: 'comfortable' as const,
        skin: 'actual' as const,
        pantalla_inicio: null,
        favoritos: [],
      },
    },
    can: (_codigo: string) => false,
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function renderView() {
  return render(
    <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
      <AuthContext.Provider value={buildAuth()}>
        <MemoryRouter>
          <ConfigMiCuenta />
        </MemoryRouter>
      </AuthContext.Provider>
    </AppProfileProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWhoami.mockResolvedValue({ id: 'u1', nombreCompleto: 'Juan Perez' });
  mockUpdate.mockResolvedValue(undefined);
  mockChangePassword.mockResolvedValue(undefined);
  (window as any).ferreteria = {
    auth: { whoami: mockWhoami },
    usuario: {
      update: mockUpdate,
      changePassword: mockChangePassword,
    },
  };
});

describe('ConfigMiCuenta', () => {
  it('muestra secciones de información personal y cambiar contraseña', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Información personal')).toBeInTheDocument());
    expect(screen.getAllByText('Cambiar contraseña').length).toBeGreaterThan(0);
  });

  it('no muestra sección PIN de acceso rápido', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Información personal')).toBeInTheDocument());
    expect(screen.queryByText(/pin de acceso rápido/i)).not.toBeInTheDocument();
  });

  it('actualizar datos llama a usuario.update', async () => {
    renderView();
    await waitFor(() => expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument());

    const nombreInput = screen.getByLabelText(/nombre completo/i);
    fireEvent.change(nombreInput, { target: { value: 'Nuevo Nombre' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar datos/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_completo: 'Nuevo Nombre' })
    ));
  });

  it('cambiar contraseña llama a changePassword', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Información personal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^contraseña actual/i), { target: { value: 'current123' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({ current_password: 'current123', new_password: 'newpass123' })
    ));
  });
});
