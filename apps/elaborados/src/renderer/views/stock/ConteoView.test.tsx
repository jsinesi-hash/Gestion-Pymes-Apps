import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConteoView } from './ConteoView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const ARTICULOS_BASE = [
  { id: '1', nombre: 'Harina 000', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: true, stock_minimo: 5, costo_promedio_centavos: 100, activo: true, stock: 20 },
  { id: '2', nombre: 'Tacho vacío ejemplo', tipo: 'insumo', unidad: 'u', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 0, activo: true, stock: 0 },
];

const mockList = vi.fn();
const mockMovimientoCreate = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('elaborados', {
  articulo: {
    list: mockList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  movimientoArticulo: {
    list: vi.fn(),
    create: mockMovimientoCreate,
  },
});

function renderView() {
  return render(<MemoryRouter><ConteoView /></MemoryRouter>);
}

describe('ConteoView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a })));
    mockMovimientoCreate.mockResolvedValue(undefined);
  });

  it('muestra la lista de articulos con el stock actual', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());
    expect(screen.getByText('Tacho vacío ejemplo')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('el buscador filtra la lista por nombre', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/buscar artículo/i), { target: { value: 'harina' } });

    expect(screen.getByText('Harina 000')).toBeInTheDocument();
    expect(screen.queryByText('Tacho vacío ejemplo')).not.toBeInTheDocument();
  });

  it('"Tacho vacío" está deshabilitado cuando el stock es 0', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    const filas = screen.getAllByRole('row');
    // fila 0 = encabezado, fila 1 = Harina 000 (stock 20), fila 2 = Tacho vacío ejemplo (stock 0)
    const botonesFilaCero = filas[2].querySelectorAll('button');
    const botonTachoVacio = Array.from(botonesFilaCero).find((b) => /tacho vacío/i.test(b.textContent ?? ''));
    expect(botonTachoVacio).toBeDisabled();
  });

  it('"Tacho vacío" llama a movimientoArticulo.create con cantidad = -stock actual cuando hay stock', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    const filas = screen.getAllByRole('row');
    const botonesFilaHarina = filas[1].querySelectorAll('button');
    const botonTachoVacio = Array.from(botonesFilaHarina).find((b) => /tacho vacío/i.test(b.textContent ?? '')) as HTMLElement;
    fireEvent.click(botonTachoVacio);

    await waitFor(() => expect(mockMovimientoCreate).toHaveBeenCalledWith({
      articulo_id: '1',
      motivo: 'conteo',
      cantidad: -20,
      observaciones: 'Tacho vacío',
    }));
  });

  it('"Ajustar" abre el modal y al enviar un nuevo stock calcula el delta correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^ajustar$/i })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const inputStock = screen.getByLabelText(/nuevo stock/i);
    fireEvent.change(inputStock, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockMovimientoCreate).toHaveBeenCalledWith({
      articulo_id: '1',
      motivo: 'conteo',
      cantidad: -5,
    }));
  });
});
