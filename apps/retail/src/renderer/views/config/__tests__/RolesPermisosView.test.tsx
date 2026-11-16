import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { RolesPermisosView, AuthContext } from '@core/ui';

const mockMatriz = vi.fn();
const mockActualizarRol = vi.fn();
const mockRebuild = vi.fn();
const actualizarSesion = vi.fn();

const MATRIZ = {
  roles: [
    { id: 'r_op', nombre: 'OPERADOR' },
    { id: 'r_sup', nombre: 'SUPERVISOR' },
  ],
  permisos: [
    { codigo: 'venta.crear', descripcion: null, modulo: 'ventas' },
    { codigo: 'venta.anular', descripcion: null, modulo: 'ventas' },
    { codigo: 'usuario.administrar', descripcion: null, modulo: 'admin' },
  ],
  porRol: {
    r_op: ['venta.crear'],
    r_sup: ['venta.crear', 'venta.anular', 'usuario.administrar'],
  },
};

function renderVista(rolId = 'r_sup') {
  const auth = {
    session: { id: 'u1', rolId, rolNombre: 'SUPERVISOR', permisos: ['usuario.administrar'] },
    can: () => true, login: vi.fn(), logout: vi.fn(), actualizarPreferencias: vi.fn(), actualizarSesion,
  } as any;
  return render(<AuthContext.Provider value={auth}><RolesPermisosView /></AuthContext.Provider>);
}

const casilla = (rol: string, etiqueta: string) =>
  screen.getByRole('checkbox', { name: `${rol}: ${etiqueta}` }) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockMatriz.mockResolvedValue(MATRIZ);
  mockActualizarRol.mockImplementation(async ({ permisos }: { permisos: string[] }) => ({ permisos }));
  (window as any).ferreteria = {
    permisos: { matriz: mockMatriz, actualizarRol: mockActualizarRol },
    menu: { rebuild: mockRebuild.mockResolvedValue(undefined) },
  };
});

describe('RolesPermisosView (ADR-087 + ADR-147)', () => {
  it('muestra nombres amigables, columnas por rol y una casilla por rol y permiso', async () => {
    renderVista();
    expect(await screen.findByText('Vender (POS)')).toBeInTheDocument();
    expect(screen.getByText('Anular ventas')).toBeInTheDocument();
    expect(screen.getAllByText('OPERADOR').length).toBeGreaterThan(0);
    expect(casilla('OPERADOR', 'Vender (POS)').checked).toBe(true);
    expect(casilla('OPERADOR', 'Anular ventas').checked).toBe(false);
    expect(casilla('SUPERVISOR', 'Anular ventas').checked).toBe(true);
  });

  it('resume el conteo por rol (Operador 1/3, Supervisor 3/3)', async () => {
    renderVista();
    await screen.findByText('Vender (POS)');
    expect(screen.getAllByText(/\/ 3 permisos/).length).toBe(2);
  });

  it('marcar una casilla deja un cambio sin guardar y habilita Guardar', async () => {
    renderVista();
    await screen.findByText('Vender (POS)');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
    fireEvent.click(casilla('OPERADOR', 'Anular ventas'));
    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeEnabled();
  });

  it('Descartar vuelve al estado guardado', async () => {
    renderVista();
    await screen.findByText('Vender (POS)');
    fireEvent.click(casilla('OPERADOR', 'Anular ventas'));
    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(casilla('OPERADOR', 'Anular ventas').checked).toBe(false);
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
  });

  it('Guardar manda el conjunto completo solo de los roles cambiados y recarga la matriz', async () => {
    renderVista();
    await screen.findByText('Vender (POS)');
    fireEvent.click(casilla('OPERADOR', 'Anular ventas'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(mockActualizarRol).toHaveBeenCalledTimes(1));
    const arg = mockActualizarRol.mock.calls[0][0];
    expect(arg.rolId).toBe('r_op');
    expect([...arg.permisos].sort()).toEqual(['venta.anular', 'venta.crear']);
    expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument();
    expect(mockMatriz).toHaveBeenCalledTimes(2);
    // No es el rol propio: la sesión no se toca.
    expect(actualizarSesion).not.toHaveBeenCalled();
  });

  it('al guardar el propio rol, la sesión y el menú toman los permisos nuevos', async () => {
    renderVista('r_sup');
    await screen.findByText('Vender (POS)');
    fireEvent.click(casilla('SUPERVISOR', 'Anular ventas'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(actualizarSesion).toHaveBeenCalledWith({ permisos: ['venta.crear', 'usuario.administrar'] }));
    expect(mockRebuild).toHaveBeenCalled();
  });

  it('"Administrar usuarios" del propio rol está bloqueado, con el motivo', async () => {
    renderVista('r_sup');
    await screen.findByText('Vender (POS)');
    const c = casilla('SUPERVISOR', 'Administrar usuarios');
    expect(c).toBeDisabled();
    expect(c.closest('td')).toHaveAttribute('title', expect.stringMatching(/tu propio rol/i));
    // En otro rol se puede marcar.
    expect(casilla('OPERADOR', 'Administrar usuarios')).toBeEnabled();
  });

  it('muestra el error traducido si el main rechaza el cambio', async () => {
    mockActualizarRol.mockRejectedValue(new Error('SIN_ADMINISTRADOR'));
    renderVista('r_op');
    await screen.findByText('Vender (POS)');
    fireEvent.click(casilla('SUPERVISOR', 'Administrar usuarios'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos un usuario activo/i);
    // El cambio queda pendiente para corregirlo o descartarlo.
    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
  });

  it('muestra error si no se puede cargar la matriz', async () => {
    mockMatriz.mockRejectedValue(new Error('FORBIDDEN'));
    renderVista();
    expect(await screen.findByRole('alert')).toHaveTextContent(/permiso/i);
  });

  it('cada fila tiene el código crudo como ayuda', async () => {
    renderVista();
    const celda = await screen.findByText('Anular ventas');
    expect(within(celda.closest('tr')!).getByTitle('venta.anular')).toBeInTheDocument();
  });
});
