import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModificadoresView } from './ModificadoresView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const GRUPOS_BASE = [
  { id: 'g1', nombre: 'Sabores' },
];

const ARTICULOS_BASE = [
  { id: 'a1', nombre: 'Frutilla', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: true, stock_minimo: null, costo_promedio_centavos: 0, activo: true, stock: 10 },
  { id: 'a2', nombre: 'Vainilla', tipo: 'elaborado', unidad: 'kg', bloquea_sin_stock: true, stock_minimo: null, costo_promedio_centavos: 0, activo: true, stock: 10 },
  { id: 'a3', nombre: 'Vaso descartable', tipo: 'reventa', unidad: 'u', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 0, activo: true, stock: 100 },
];

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn().mockResolvedValue(undefined);
const mockOpcionSet = vi.fn().mockResolvedValue(undefined);
const mockArticuloList = vi.fn();

vi.stubGlobal('elaborados', {
  grupoModificador: {
    list: mockList,
    get: mockGet,
    create: mockCreate,
    opcionSet: mockOpcionSet,
  },
  articulo: {
    list: mockArticuloList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

function renderView() {
  return render(<MemoryRouter><ModificadoresView /></MemoryRouter>);
}

describe('ModificadoresView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(GRUPOS_BASE.map((g) => ({ ...g })));
    mockArticuloList.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a })));
    mockGet.mockResolvedValue({ nombre: 'Sabores', opciones: [] });
    mockCreate.mockResolvedValue(undefined);
    mockOpcionSet.mockResolvedValue(undefined);
  });

  it('muestra los grupos cargados', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Sabores')).toBeInTheDocument());
  });

  it('oculta el form de alta y el botón "Opciones" cuando el usuario no tiene el permiso producto_venta.gestionar', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('Sabores')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/nombre del grupo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /opciones/i })).not.toBeInTheDocument();
  });

  it('al enviar el form de nuevo grupo llama a grupoModificador.create con el nombre', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Sabores')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/nombre del grupo/i), { target: { value: 'Toppings' } });
    fireEvent.click(screen.getByRole('button', { name: /nuevo grupo/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ nombre: 'Toppings' }));
  });

  it('al abrir "Opciones" y guardar, llama a grupoModificador.opcionSet con el payload correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Sabores')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /opciones/i }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith({ id: 'g1' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /agregar opción/i }));
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockOpcionSet).toHaveBeenCalledWith({
      grupo_modificador_id: 'g1',
      opciones: [{ articulo_id: 'a1', nombre: 'Frutilla', recargo_centavos: 0, cantidad: 0, orden: 1 }],
    }));
  });

  it('muestra el mensaje traducido y no cierra el modal cuando guardar las opciones falla', async () => {
    mockOpcionSet.mockRejectedValueOnce(new Error('ALGO_INESPERADO'));
    renderView();
    await waitFor(() => expect(screen.getByText('Sabores')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /opciones/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /agregar opción/i }));
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo completar la operación/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
