import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarcasView } from '../MarcasView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const mockListAll = vi.fn().mockResolvedValue([
  { id: '1', nombre: 'Stanley', descripcion: 'Herramientas', activo: true },
  { id: '2', nombre: 'Inactiva', descripcion: null, activo: false },
]);
const mockDesactivar = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('ferreteria', {
  catalogo: {
    marca: {
      listAll: mockListAll,
      create: vi.fn().mockResolvedValue({ id: '3', nombre: 'X', activo: true }),
      update: vi.fn(),
      desactivar: mockDesactivar,
      reactivar: vi.fn(),
    },
  },
});

describe('MarcasView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAll.mockResolvedValue([
      { id: '1', nombre: 'Stanley', descripcion: 'Herramientas', activo: true },
      { id: '2', nombre: 'Inactiva', descripcion: null, activo: false },
    ]);
    mockDesactivar.mockResolvedValue(undefined);
  });

  it('muestra las marcas cargadas', async () => {
    render(<MemoryRouter><MarcasView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Stanley')).toBeInTheDocument());
    expect(screen.getAllByText('Inactiva').length).toBeGreaterThan(0);
  });

  it('muestra error TIENE_PRODUCTOS cuando desactivar falla', async () => {
    mockDesactivar.mockRejectedValue(new Error('TIENE_PRODUCTOS:5'));
    render(<MemoryRouter><MarcasView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Stanley')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /desactivar/i })[0]);
    await waitFor(() =>
      expect(screen.getByText(/tiene 5 producto/i)).toBeInTheDocument()
    );
  });
});
