import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { RutinasView } from './RutinasView';

// AuthContext: la vista/form usan useAuth().session
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ session: { id: 'admin-1', nombreCompleto: 'Admin', permisos: [] }, can: () => true }),
}));

const list = vi.fn();
const crear = vi.fn();
const pausar = vi.fn();
const reanudar = vi.fn();
const eliminar = vi.fn();
const rolList = vi.fn();

beforeEach(() => {
  [list, crear, pausar, reanudar, eliminar, rolList].forEach((f) => f.mockReset());
  crear.mockResolvedValue({});
  pausar.mockResolvedValue({ ok: true });
  reanudar.mockResolvedValue({ ok: true });
  eliminar.mockResolvedValue({ ok: true });
  rolList.mockResolvedValue([{ id: 'r1', nombre: 'SUPERVISOR' }, { id: 'r2', nombre: 'OPERADOR' }]);
  (globalThis as any).ferreteria = {
    rutina: { list, crear, pausar, reanudar, eliminar },
    rol: { list: rolList },
  };
});

function unaRutina(over: Partial<any> = {}) {
  return {
    id: 'ru1', nombre: 'Pedido semanal', descripcion: null, frecuencia_tipo: 'semanal',
    intervalo: 1, dia_semana: 1, dia_mes: null, hora: '09:00',
    fecha_inicio: Date.now(), fecha_fin: null, proximo_disparo: Date.now() + 86400000,
    destinatario_tipo: 'usuario', destinatario_usuario_id: 'admin-1', destinatario_rol: null,
    canal_in_app: true, canal_email: false, activa: true, ...over,
  };
}

describe('RutinasView', () => {
  it('lista rutinas con su frecuencia', async () => {
    list.mockResolvedValue([unaRutina()]);
    render(<RutinasView />);
    expect(await screen.findByText('Pedido semanal')).toBeInTheDocument();
    expect(screen.getByText('Semanal')).toBeInTheDocument();
  });

  it('pausar llama al IPC', async () => {
    list.mockResolvedValue([unaRutina()]);
    render(<RutinasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(pausar).toHaveBeenCalledWith({ id: 'ru1' }));
  });

  it('reanudar aparece para una rutina pausada', async () => {
    list.mockResolvedValue([unaRutina({ activa: false })]);
    render(<RutinasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reanudar' }));
    await waitFor(() => expect(reanudar).toHaveBeenCalledWith({ id: 'ru1' }));
  });

  it('crear una rutina desde el modal invoca rutina.crear', async () => {
    list.mockResolvedValue([]);
    render(<RutinasView />);
    fireEvent.click(await screen.findByText('+ Nueva rutina'));
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Revisar depósito' } });
    fireEvent.click(screen.getByText('Crear rutina'));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0][0].nombre).toBe('Revisar depósito');
  });

  it('el modal de "Nueva rutina" cierra con Escape', async () => {
    list.mockResolvedValue([]);
    render(<RutinasView />);
    fireEvent.click(await screen.findByText('+ Nueva rutina'));
    await screen.findByLabelText('Nombre');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });

  it('el modal de eliminar rutina cierra con Escape', async () => {
    list.mockResolvedValue([unaRutina()]);
    render(<RutinasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText(/eliminar «pedido semanal»/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByText(/eliminar «pedido semanal»/i)).not.toBeInTheDocument();
  });

  it('pausar con falla de IPC muestra el error (antes quedaba en silencio)', async () => {
    list.mockResolvedValue([unaRutina()]);
    pausar.mockRejectedValue(new Error('RUTINA_EN_USO'));
    render(<RutinasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('RUTINA_EN_USO'));
    // la rutina sigue activa: no se aplicó ningún cambio optimista
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeEnabled();
  });

  it('eliminar con falla de IPC muestra el error dentro del modal y no lo cierra', async () => {
    list.mockResolvedValue([unaRutina()]);
    eliminar.mockRejectedValue(new Error('RUTINA_CON_EVENTOS_PENDIENTES'));
    render(<RutinasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('dialog', { name: /eliminar rutina/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('RUTINA_CON_EVENTOS_PENDIENTES'));
    // el modal de confirmación sigue abierto (no se descartó el intento silenciosamente)
    expect(screen.getByText(/eliminar «pedido semanal»/i)).toBeInTheDocument();
  });
});
