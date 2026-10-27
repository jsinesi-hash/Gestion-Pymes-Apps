import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext, AppProfileProvider, Login } from '@core/ui';
import { navegacionRetail } from '../../common/navegacion';

const mockLogin = vi.fn();

// Login vive en @core/ui e importa useNavigate desde 'react-router-dom'; mockear el módulo no
// intercepta al componente ya empaquetado en otro paquete, así que se usa un MemoryRouter real
// y una sonda captura la ruta a la que navega tras un login exitoso.
let ultimaRuta = '';
function SondaRuta() {
  ultimaRuta = useLocation().pathname;
  return null;
}

function renderLogin(loginFn = mockLogin) {
  return render(
    <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
      <AuthContext.Provider value={{ session: null, can: () => false, login: loginFn, logout: async () => {}, actualizarPreferencias: () => {} }}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
          <SondaRuta />
        </MemoryRouter>
      </AuthContext.Provider>
    </AppProfileProvider>
  );
}

describe('Login', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('renderiza campo usuario y contraseña por defecto', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Usuario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
  });

  it('submit con campos vacíos no llama a login', async () => {
    renderLogin();
    fireEvent.click(screen.getByText('Ingresar'));
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submit con datos llama login y navega a /', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByText('Ingresar'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ nombreUsuario: 'admin', password: 'admin1234' });
      expect(ultimaRuta).toBe('/');
    });
  });

  it('muestra error cuando login falla', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'mal' } });
    fireEvent.click(screen.getByText('Ingresar'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciales inválidas');
    });
  });
});

describe('Login — bloqueo por intentos (P1 2026-10-20)', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('muestra cuánto falta cuando la cuenta está bloqueada, en vez de "Credenciales inválidas"', async () => {
    mockLogin.mockRejectedValue(new Error("Error invoking remote method 'auth:login': Error: CUENTA_BLOQUEADA:900"));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByText('Ingresar'));
    await waitFor(() => {
      const alerta = screen.getByRole('alert');
      expect(alerta).toHaveTextContent(/Demasiados intentos/);
      expect(alerta).toHaveTextContent(/15 minutos/);
      expect(alerta).not.toHaveTextContent('Credenciales inválidas');
    });
  });
});

describe('Login — ver contraseña', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('la contraseña arranca oculta', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('el botón revela la contraseña y vuelve a ocultarla', () => {
    renderLogin();
    const campo = screen.getByPlaceholderText('Contraseña');

    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
    expect(campo).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }));
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('alternar la visibilidad no envía el formulario', () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'admin1234' } });

    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('el botón queda fuera del recorrido de tabulación', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /mostrar contraseña/i })).toHaveAttribute('tabindex', '-1');
  });

  it('conserva el valor tipeado al alternar la visibilidad', () => {
    renderLogin();
    const campo = screen.getByPlaceholderText('Contraseña');
    fireEvent.change(campo, { target: { value: 'secreto' } });
    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
    expect(campo).toHaveValue('secreto');
  });
});
