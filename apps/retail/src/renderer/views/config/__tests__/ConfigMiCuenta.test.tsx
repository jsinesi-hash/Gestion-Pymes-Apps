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
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: 'Newpass#123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'Newpass#123' } });
    fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith(
      expect.objectContaining({ current_password: 'current123', new_password: 'Newpass#123' })
    ));
  });

  // Revisión 2026-10-20 (P1): política de contraseña (8+, mayúscula, número, carácter especial).
  it.each([
    ['corta', 'Ab1#xyz', /8 caracteres/],
    ['sin mayúscula', 'newpass#123', /mayúscula/],
    ['sin número', 'Newpass#abc', /número/],
    ['sin carácter especial', 'Newpass1234', /carácter especial/],
  ])('contraseña nueva %s: avisa y no llama a changePassword', async (_n, nueva, mensaje) => {
    mockChangePassword.mockClear();
    renderView();
    await waitFor(() => expect(screen.getByText('Información personal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^contraseña actual/i), { target: { value: 'current123' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: nueva } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: nueva } });
    fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => expect(screen.getByText(mensaje)).toBeInTheDocument());
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('si el main rechaza (p. ej. igual al usuario) muestra el mensaje traducido, no el código', async () => {
    mockChangePassword.mockReset();
    mockChangePassword.mockRejectedValue(new Error("Error invoking remote method 'usuario:changePassword': Error: PASSWORD_DEBIL:USUARIO"));
    renderView();
    await waitFor(() => expect(screen.getByText('Información personal')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^contraseña actual/i), { target: { value: 'current123' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: 'Newpass#123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'Newpass#123' } });
    fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

    await waitFor(() => expect(screen.getByText(/nombre de usuario/i)).toBeInTheDocument());
    expect(screen.queryByText(/PASSWORD_DEBIL/)).toBeNull();
  });
});

// ADR-136: «Mi cuenta» muestra cuántos días le quedan a la contraseña y, al cambiarla, el plazo vuelve a 30.
describe('ConfigMiCuenta — vigencia de la contraseña (ADR-136)', () => {
  const actualizarSesion = vi.fn();

  function renderConDias(dias: number | undefined) {
    const auth = buildAuth();
    return render(
      <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
        <AuthContext.Provider value={{
          ...auth,
          session: { ...auth.session, ...(dias === undefined ? {} : { passwordDiasRestantes: dias }) },
          actualizarSesion,
        }}>
          <MemoryRouter>
            <ConfigMiCuenta />
          </MemoryRouter>
        </AuthContext.Provider>
      </AppProfileProvider>
    );
  }

  beforeEach(() => {
    actualizarSesion.mockReset();
    mockWhoami.mockResolvedValue({ id: 'u1', nombreCompleto: 'Juan Perez' });
    (window as any).ferreteria.usuario.list = vi.fn().mockResolvedValue([
      { id: 'u1', nombre_usuario: 'jperez', nombre_completo: 'Juan Perez', email: 'juan@ejemplo.com' },
    ]);
  });

  it('muestra los días que quedan', async () => {
    renderConDias(12);
    expect(await screen.findByTestId('password-vigencia')).toHaveTextContent('Tu contraseña vence en 12 días.');
  });

  it('con 1 día usa el singular', async () => {
    renderConDias(1);
    expect(await screen.findByTestId('password-vigencia')).toHaveTextContent('Tu contraseña vence en 1 día.');
  });

  it('con 0 días avisa que vence hoy', async () => {
    renderConDias(0);
    expect(await screen.findByTestId('password-vigencia')).toHaveTextContent('Tu contraseña vence hoy.');
  });

  it('sin el dato (sesión de un main anterior) no muestra nada', async () => {
    renderConDias(undefined);
    await screen.findByRole('button', { name: 'Cambiar contraseña' });
    expect(screen.queryByTestId('password-vigencia')).not.toBeInTheDocument();
  });
});

describe('ConfigMiCuenta — al cambiar la contraseña el plazo vuelve a 30 días (ADR-136)', () => {
  it('actualiza la sesión con 30 días tras un cambio exitoso', async () => {
    const actualizarSesion = vi.fn();
    const auth = buildAuth();
    (window as any).ferreteria.usuario.list = vi.fn().mockResolvedValue([
      { id: 'u1', nombre_usuario: 'jperez', nombre_completo: 'Juan Perez', email: 'juan@ejemplo.com' },
    ]);
    render(
      <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
        <AuthContext.Provider value={{ ...auth, session: { ...auth.session, passwordDiasRestantes: 3 }, actualizarSesion }}>
          <MemoryRouter>
            <ConfigMiCuenta />
          </MemoryRouter>
        </AuthContext.Provider>
      </AppProfileProvider>
    );
    fireEvent.change(await screen.findByLabelText(/contraseña actual/i), { target: { value: 'Vieja#2026x' } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: 'Nueva#2026x' } });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), { target: { value: 'Nueva#2026x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(actualizarSesion).toHaveBeenCalledWith({ passwordDiasRestantes: 30 }));
  });
});
