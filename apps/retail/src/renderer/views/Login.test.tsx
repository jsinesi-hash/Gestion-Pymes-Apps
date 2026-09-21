import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Login from './Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin(loginFn = mockLogin) {
  return render(
    <AuthContext.Provider value={{ session: null, can: () => false, login: loginFn, logout: async () => {}, actualizarPreferencias: () => {} }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Login', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
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
      expect(mockNavigate).toHaveBeenCalledWith('/');
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

describe('Login — ver contraseña', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
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
