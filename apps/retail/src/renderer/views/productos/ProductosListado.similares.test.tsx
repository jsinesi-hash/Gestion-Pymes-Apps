import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosListado } from './ProductosListado';
import { CatalogoProvider } from '../../context/CatalogoContext';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockList = vi.fn();
const mockBuscarSimilares = vi.fn();
const mockParametrosGet = vi.fn();

function setupFerreteria(flag: string | null) {
  mockList.mockResolvedValue({ items: [], total: 0 });
  mockParametrosGet.mockResolvedValue(flag);
  (window as any).ferreteria = {
    parametros: { get: mockParametrosGet },
    catalogo: {
      producto: { list: mockList, buscarSimilares: mockBuscarSimilares },
      categoria: { list: vi.fn().mockResolvedValue([]) },
      marca: { list: vi.fn().mockResolvedValue([]) },
    },
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <CatalogoProvider>
        <ProductosListado />
      </CatalogoProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ProductosListado — modo Buscar similares (detrás de flag)', () => {
  it('con el flag apagado no muestra el toggle', async () => {
    setupFerreteria('false');
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /similares/i })).toBeNull();
  });

  it('con el flag encendido muestra el toggle y, al activarlo, busca por similitud y rankea', async () => {
    setupFerreteria('true');
    mockBuscarSimilares.mockResolvedValue([
      { producto_id: 'p1', sku: 'P-0000001-1', nombre_corto: 'Tarugo plástico 8mm', marca_nombre: null,
        precio_final_centavos: 10000, precio_origen: 'vigente', stock_fisico: 0, score: 0.8 },
    ]);
    renderView();

    const toggle = await screen.findByRole('button', { name: /similares/i });
    fireEvent.click(toggle);

    const input = screen.getByPlaceholderText(/nombre, SKU o EAN/i);
    fireEvent.change(input, { target: { value: 'tarugo 8 mm' } });

    await waitFor(() => expect(mockBuscarSimilares).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'tarugo 8 mm' }),
    ));
    expect(await screen.findByText('Tarugo plástico 8mm')).toBeInTheDocument();
  });

  it('muestra columnas Precio y Stock con los datos enriquecidos', async () => {
    setupFerreteria('true');
    mockBuscarSimilares.mockResolvedValue([
      { producto_id: 'p1', sku: 'P-0000001-1', nombre_corto: 'Pincel 3x8', marca_nombre: 'Marca A',
        precio_final_centavos: 150000, precio_origen: 'vigente', stock_fisico: 7, score: 0.95 },
    ]);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: /similares/i }));
    fireEvent.change(screen.getByPlaceholderText(/nombre, SKU o EAN/i), { target: { value: 'pincel 3x8' } });

    expect(await screen.findByText('$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Precio' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Stock' })).toBeInTheDocument();
  });
});
