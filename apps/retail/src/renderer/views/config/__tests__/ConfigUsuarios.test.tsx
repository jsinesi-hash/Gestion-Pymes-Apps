import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AppProfileProvider, ConfigUsuarios } from '@core/ui';
import { navegacionRetail } from '../../../../common/navegacion';

// ADR-136: el mail es obligatorio (recuperación de contraseña) en el alta y no se puede vaciar al
// editar; el restablecimiento por un Supervisor avisa que la persona deberá cambiar la clave.
const mockList = vi.fn();
const mockRoles = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

const USUARIO = {
  id: 'u1', nombre_usuario: 'ana', nombre_completo: 'Ana Pérez', email: 'ana@ejemplo.com',
  activo: true, rol_id: 'r1', rol_nombre: 'OPERADOR',
};

function renderView() {
  const auth = {
    session: {
      id: 'sup', nombreCompleto: 'Super', rolId: 'rs', rolNombre: 'SUPERVISOR', permisos: ['usuario.administrar'],
      preferencias: {
        tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const,
        densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [],
      },
    },
    can: () => true, login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {},
  };
  return render(
    <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter><ConfigUsuarios /></MemoryRouter>
      </AuthContext.Provider>
    </AppProfileProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([USUARIO]);
  mockRoles.mockResolvedValue([{ id: 'r1', nombre: 'OPERADOR' }]);
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  (window as any).ferreteria = {
    usuario: { list: mockList, create: mockCreate, update: mockUpdate, changePassword: vi.fn() },
    rol: { list: mockRoles },
  };
});

describe('ConfigUsuarios — mail obligatorio (ADR-136)', () => {
  async function abrirAlta() {
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: /nuevo usuario/i }));
    await screen.findByLabelText(/nombre de usuario/i);
  }

  function completarAlta(email: string) {
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Luis Gómez' } });
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: 'luis' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/^contraseña \*/i), { target: { value: 'Clave#2026x' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'Clave#2026x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  }

  it('el campo de mail del alta es obligatorio', async () => {
    await abrirAlta();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
  });

  it('el alta envía el mail recortado', async () => {
    await abrirAlta();
    completarAlta('  luis@ejemplo.com ');
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      nombre_usuario: 'luis', email: 'luis@ejemplo.com',
    })));
  });

  it('si el main rechaza el alta por mail, se muestra el mensaje traducido', async () => {
    mockCreate.mockRejectedValue(new Error('EMAIL_INVALIDO'));
    await abrirAlta();
    completarAlta('luis@ejemplo.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(/correo electrónico no es válido/i);
  });
});

describe('ConfigUsuarios — restablecer la contraseña de otro', () => {
  // Visto en la app: el modal decía el nombre completo («Cajero») y se intentó ingresar con ese
  // nombre en vez del usuario («Marcos»).
  it('el modal dice con qué usuario se ingresa y que la clave es provisoria', async () => {
    renderView();
    fireEvent.click(await screen.findByTitle('Cambiar contraseña'));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent(/ingresa con el usuario\s*ana/i);
    expect(dialogo).toHaveTextContent(/provisoria/i);
  });
});
