import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CategoriasVentaView } from './CategoriasVentaView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const CATEGORIAS_BASE = [
  { id: '1', nombre: 'Helados', orden: 1, activo: true },
  { id: '2', nombre: 'Bebidas', orden: 2, activo: true },
];

const mockList = vi.fn();
const mockCreate = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('elaborados', {
  categoriaVenta: {
    list: mockList,
    create: mockCreate,
  },
});

function renderView() {
  return render(<MemoryRouter><CategoriasVentaView /></MemoryRouter>);
}

describe('CategoriasVentaView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(CATEGORIAS_BASE.map((c) => ({ ...c })));
    mockCreate.mockResolvedValue(undefined);
  });

  it('muestra las categorías cargadas', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Helados')).toBeInTheDocument());
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
  });

  it('oculta "+ Nueva categoría" cuando el usuario no tiene el permiso producto_venta.gestionar', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('Helados')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /nueva categoría/i })).not.toBeInTheDocument();
  });

  it('al enviar el formulario llama a categoriaVenta.create con el payload correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Helados')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nueva categoría/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Postres' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ nombre: 'Postres', orden: 3 }));
  });

  it('muestra el mensaje traducido y no cierra el modal cuando la creación falla', async () => {
    mockCreate.mockRejectedValueOnce(new Error('ALGO_INESPERADO'));
    renderView();
    await waitFor(() => expect(screen.getByText('Helados')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nueva categoría/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Postres' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo completar la operación/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
