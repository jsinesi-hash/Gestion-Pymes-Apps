import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@core/ui';
import { ListasPreciosView, DetalleAjustesTab } from '../ListasPreciosView';

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

// Revisión 2026-10-20 (P1): con el flag del motor v2 apagado (default) la pestaña "Detalle" es
// alcanzable y llamaba a `precios.detalle`, un namespace que ADR-081 retiró del preload: lanzaba
// un TypeError dentro del efecto. El tipado de `bridge()` lo destapó.
describe('DetalleAjustesTab (namespace precios.detalle retirado, ADR-081)', () => {
  it('no se rompe sin precios.detalle: muestra la tabla vacía', async () => {
    (window as any).ferreteria = { precios: {} };
    render(<DetalleAjustesTab listaId="l1" listaAjuste={5} />);
    await waitFor(() => expect(screen.getByText('Ajuste general')).toBeInTheDocument());
  });

  it('si el main lo vuelve a exponer, lista los ajustes', async () => {
    const listByLista = vi.fn().mockResolvedValue([{ producto_id: 'p9', ajuste_porcentual: -3 }]);
    (window as any).ferreteria = { precios: { detalle: { listByLista } } };
    render(<DetalleAjustesTab listaId="l1" listaAjuste={5} />);
    await waitFor(() => expect(screen.getByText('p9')).toBeInTheDocument());
    expect(listByLista).toHaveBeenCalledWith('l1');
  });
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
