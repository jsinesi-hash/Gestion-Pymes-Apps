import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
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

// ADR-136: con la contraseña vencida o sin mail el login no abre sesión; la pantalla muestra el paso
// que corresponde y reenvía las credenciales.
describe('Login — contraseña vencida y mail obligatorio (ADR-136)', () => {
  const mockCambiar = vi.fn();
  const mockCompletar = vi.fn();
  const NUEVA = 'Nueva#2026x';

  function renderPasos() {
    return render(
      <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
        <AuthContext.Provider value={{
          session: null, can: () => false, login: mockLogin, logout: async () => {}, actualizarPreferencias: () => {},
          cambiarPasswordVencida: mockCambiar, completarEmail: mockCompletar,
        }}>
          <MemoryRouter initialEntries={['/login']}>
            <Login />
            <SondaRuta />
          </MemoryRouter>
        </AuthContext.Provider>
      </AppProfileProvider>
    );
  }

  async function ingresarCon(codigo: string) {
    mockLogin.mockRejectedValue(new Error(codigo));
    renderPasos();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'Vieja#2026x' } });
    fireEvent.click(screen.getByText('Ingresar'));
  }

  beforeEach(() => {
    mockLogin.mockReset(); mockCambiar.mockReset(); mockCompletar.mockReset();
    ultimaRuta = '';
  });

  it('PASSWORD_VENCIDA muestra el paso de cambio y no navega', async () => {
    await ingresarCon('PASSWORD_VENCIDA');
    // Cubre los dos casos: venció por plazo o un administrador la restableció.
    expect(await screen.findByText(/elegí una contraseña nueva/i)).toBeInTheDocument();
    expect(screen.getByText(/restableció/i)).toBeInTheDocument();
    expect(screen.getByText(/a partir de ahora/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nueva contraseña')).toBeInTheDocument();
    expect(ultimaRuta).toBe('/login');
  });

  it('cambia la contraseña con la actual tipeada y navega a /', async () => {
    mockCambiar.mockResolvedValue(undefined);
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.change(await screen.findByPlaceholderText('Nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => {
      expect(mockCambiar).toHaveBeenCalledWith({ nombreUsuario: 'ana', passwordActual: 'Vieja#2026x', passwordNueva: NUEVA });
      expect(ultimaRuta).toBe('/');
    });
  });

  it('contraseñas que no coinciden: avisa y no llama al main', async () => {
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.change(await screen.findByPlaceholderText('Nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: NUEVA + 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no coinciden/i);
    expect(mockCambiar).not.toHaveBeenCalled();
  });

  it('contraseña débil: muestra el motivo y no llama al main', async () => {
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.change(await screen.findByPlaceholderText('Nueva contraseña'), { target: { value: 'corta' } });
    fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockCambiar).not.toHaveBeenCalled();
  });

  it('si el main rechaza el cambio, muestra el error traducido y se queda en el paso', async () => {
    mockCambiar.mockRejectedValue(new Error('PASSWORD_IGUAL_A_LA_ACTUAL'));
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.change(await screen.findByPlaceholderText('Nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/distinta de la actual/i);
    expect(ultimaRuta).toBe('/login');
  });

  it('EMAIL_REQUERIDO muestra el paso del mail; uno inválido no llama al main', async () => {
    await ingresarCon('EMAIL_REQUERIDO');
    fireEvent.change(await screen.findByPlaceholderText('nombre@ejemplo.com'), { target: { value: 'no-es-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar correo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo electrónico válido/i);
    expect(mockCompletar).not.toHaveBeenCalled();
  });

  it('carga el mail con las credenciales tipeadas y navega a /', async () => {
    mockCompletar.mockResolvedValue(undefined);
    await ingresarCon('EMAIL_REQUERIDO');
    fireEvent.change(await screen.findByPlaceholderText('nombre@ejemplo.com'), { target: { value: 'ana@ejemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar correo' }));
    await waitFor(() => {
      expect(mockCompletar).toHaveBeenCalledWith({ nombreUsuario: 'ana', password: 'Vieja#2026x', email: 'ana@ejemplo.com' });
      expect(ultimaRuta).toBe('/');
    });
  });

  it('si tras cambiar la clave falta el mail, sigue con el mail usando la clave NUEVA', async () => {
    mockCambiar.mockRejectedValue(new Error('EMAIL_REQUERIDO'));
    mockCompletar.mockResolvedValue(undefined);
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.change(await screen.findByPlaceholderText('Nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.change(screen.getByPlaceholderText('Repetir la nueva contraseña'), { target: { value: NUEVA } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    fireEvent.change(await screen.findByPlaceholderText('nombre@ejemplo.com'), { target: { value: 'ana@ejemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar correo' }));
    await waitFor(() => {
      expect(mockCompletar).toHaveBeenCalledWith({ nombreUsuario: 'ana', password: NUEVA, email: 'ana@ejemplo.com' });
    });
  });

  it('«Volver» regresa a las credenciales y limpia las contraseñas', async () => {
    await ingresarCon('PASSWORD_VENCIDA');
    fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen.getByPlaceholderText('Contraseña')).toHaveValue('');
    expect(screen.getByText('Ingresar')).toBeInTheDocument();
  });

  it('otros errores del login siguen mostrando el mensaje genérico', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    renderPasos();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'mal' } });
    fireEvent.click(screen.getByText('Ingresar'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });
});

// ADR-137: «Olvidé mi contraseña» solo aparece si la app tiene un correo saliente configurado.
describe('Login — enlace de recuperación de contraseña (ADR-137)', () => {
  const mockDisponible = vi.fn();

  beforeEach(() => {
    mockLogin.mockReset();
    mockDisponible.mockReset();
    (window as any).ferreteria = {
      auth: { recuperacionDisponible: mockDisponible, recuperarSolicitar: vi.fn(), recuperarConfirmar: vi.fn() },
    };
  });
  afterEach(() => { delete (window as any).ferreteria; });

  it('sin correo saliente configurado no ofrece el enlace', async () => {
    mockDisponible.mockResolvedValue(false);
    renderLogin();
    await waitFor(() => expect(mockDisponible).toHaveBeenCalled());
    expect(screen.queryByText('Olvidé mi contraseña')).not.toBeInTheDocument();
  });

  it('con correo saliente configurado ofrece el enlace', async () => {
    mockDisponible.mockResolvedValue(true);
    renderLogin();
    expect(await screen.findByText('Olvidé mi contraseña')).toBeInTheDocument();
  });

  it('si la consulta falla no rompe el login ni muestra el enlace', async () => {
    mockDisponible.mockRejectedValue(new Error('boom'));
    renderLogin();
    await waitFor(() => expect(mockDisponible).toHaveBeenCalled());
    expect(screen.getByText('Ingresar')).toBeInTheDocument();
    expect(screen.queryByText('Olvidé mi contraseña')).not.toBeInTheDocument();
  });

  it('el enlace abre la recuperación con el usuario que ya se tipeó', async () => {
    mockDisponible.mockResolvedValue(true);
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('Usuario'), { target: { value: 'ana' } });
    fireEvent.click(await screen.findByText('Olvidé mi contraseña'));
    expect(await screen.findByRole('dialog', { name: 'Recuperar contraseña' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario', { selector: '#rp-usuario' })).toHaveValue('ana');
  });

  it('cerrar la recuperación vuelve al login', async () => {
    mockDisponible.mockResolvedValue(true);
    renderLogin();
    fireEvent.click(await screen.findByText('Olvidé mi contraseña'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Recuperar contraseña' })).not.toBeInTheDocument());
  });
});
