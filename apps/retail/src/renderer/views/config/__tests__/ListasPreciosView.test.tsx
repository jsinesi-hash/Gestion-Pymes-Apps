import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { ListasPreciosView } from '../ListasPreciosView';

const mockList   = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

const LISTA_A = {
  id: 'l1', nombre: 'General', tipo: 'general',
  ajuste_porcentual: 0, predeterminada: true, activo: true,
};
const LISTA_B = {
  id: 'l2', nombre: 'Mayorista', tipo: 'especial',
  ajuste_porcentual: -10, predeterminada: false, activo: true,
};

function buildAuth(isSupervisor: boolean) {
  return {
    session: { id: 'u1', nombreCompleto: 'Admin', rolId: 'r1', rolNombre: '', permisos: [], preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] } },
    can: (codigo: string) => isSupervisor && codigo === 'config.fiscal',
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function renderView(isSupervisor = true) {
  return render(
    <AuthContext.Provider value={buildAuth(isSupervisor)}>
      <MemoryRouter>
        <ListasPreciosView />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([LISTA_A, LISTA_B]);
  mockCreate.mockResolvedValue({ ...LISTA_A, id: 'l3', nombre: 'Nueva' });
  mockUpdate.mockResolvedValue({ ...LISTA_A });
  (window as any).ferreteria = {
    precios: {
      lista: { list: mockList, create: mockCreate, update: mockUpdate, deactivate: vi.fn() },
    },
  };
});

describe('ListasPreciosView', () => {
  it('muestra las listas cargadas en la tabla', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    expect(screen.getByText('Mayorista')).toBeInTheDocument();
  });

  it('Supervisor ve botón "Nueva lista"', async () => {
    renderView(true);
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /nueva lista/i })).toBeInTheDocument();
  });

  it('Operador no ve botón "Nueva lista"', async () => {
    renderView(false);
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /nueva lista/i })).not.toBeInTheDocument();
  });

  it('badge "Predeterminada" aparece en la lista correcta', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('General')).toBeInTheDocument());
    expect(screen.getByText('Predeterminada')).toBeInTheDocument();
  });

  it('abrir modal "Nueva lista" y crear', async () => {
    renderView(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /nueva lista/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nueva lista/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledOnce());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nueva' }));
  });
});
