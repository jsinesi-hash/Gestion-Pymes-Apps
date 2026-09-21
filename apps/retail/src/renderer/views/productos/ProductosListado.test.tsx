import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosListado } from './ProductosListado';
import { CatalogoProvider } from '../../context/CatalogoContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockList = vi.fn();
const mockCategoriaList = vi.fn();
const mockMarcaList = vi.fn();

const PRODUCTS = [
  {
    id: 'p1', sku: 'P-0000001-1', nombre_corto: 'Taladro',
    precio_venta_lista: 5000, activo: true, stock_fisico: 20,
    ubicacion_sector: 'Pasillo A', ubicacion_estante: '01', ubicacion_posicion: '03',
  },
  {
    id: 'p2', sku: 'P-0000002-2', nombre_corto: 'Sierra',
    precio_venta_lista: 8000, activo: true, stock_fisico: 5,
    ubicacion_sector: null, ubicacion_estante: null, ubicacion_posicion: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ items: PRODUCTS, total: PRODUCTS.length });
  mockCategoriaList.mockResolvedValue([]);
  mockMarcaList.mockResolvedValue([]);
  (window as any).ferreteria = {
    catalogo: {
      producto: { list: mockList },
      categoria: { list: mockCategoriaList },
      marca: { list: mockMarcaList },
    },
  };
});

function renderView() {
  return render(
    <MemoryRouter>
      <CatalogoProvider>
        <ProductosListado />
      </CatalogoProvider>
    </MemoryRouter>,
  );
}

describe('ProductosListado — ADR-053', () => {
  it('por defecto pide solo productos activos', async () => {
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList.mock.calls[0][0]).toMatchObject({ activo: true });
  });

  it('renderiza columnas de ubicación (Sector/Estante/Posición)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    expect(screen.getByText('Sector')).toBeInTheDocument();
    expect(screen.getByText('Estante')).toBeInTheDocument();
    expect(screen.getByText('Posición')).toBeInTheDocument();
    expect(screen.getByText('Pasillo A')).toBeInTheDocument();
  });

  it('no menciona QR en el placeholder de búsqueda', () => {
    renderView();
    // ADR-066 item 3: el placeholder ahora menciona EAN (busqueda matchea gtin_barcode).
    expect(screen.getByPlaceholderText('Buscar por nombre, SKU o EAN...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/QR/i)).toBeNull();
  });

  it('el buscador de ubicación pasa busqueda_ubicacion al IPC', async () => {
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const input = screen.getByPlaceholderText(/Buscar ubicación/i);
    fireEvent.change(input, { target: { value: 'Pasillo A' } });
    await waitFor(() => {
      const last = mockList.mock.calls.at(-1)![0];
      expect(last.busqueda_ubicacion).toBe('Pasillo A');
    });
  });

  it('por defecto ordena por nombre_corto asc', async () => {
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList.mock.calls[0][0]).toMatchObject({ sortBy: 'nombre_corto', sortDir: 'asc' });
  });

  it('clic en la cabecera SKU ordena asc y luego desc', async () => {
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    const header = screen.getByText('SKU');

    fireEvent.click(header);
    await waitFor(() => {
      expect(mockList.mock.calls.at(-1)![0]).toMatchObject({ sortBy: 'sku', sortDir: 'asc' });
    });

    fireEvent.click(screen.getByText('SKU'));
    await waitFor(() => {
      expect(mockList.mock.calls.at(-1)![0]).toMatchObject({ sortBy: 'sku', sortDir: 'desc' });
    });
  });

  it('clic en la cabecera Sector ordena por ubicacion_sector', async () => {
    renderView();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Sector'));
    await waitFor(() => {
      const last = mockList.mock.calls.at(-1)![0];
      expect(last).toMatchObject({ sortBy: 'ubicacion_sector', sortDir: 'asc' });
    });
  });
});

describe('ProductosListado — navegación por fila completa (ADR-069)', () => {
  it('ADR-069: clic en una celda no-nombre abre el detalle del producto', async () => {
    renderView();
    const sku = await screen.findByText('P-0000001-1');
    fireEvent.click(sku.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });

  it('ADR-069: la fila es operable por teclado (Enter)', async () => {
    renderView();
    const row = (await screen.findByText('Taladro')).closest('tr')!;
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });
});

describe('ProductosListado — BUG-1: fila navegable en su propio componente', () => {
  it('cambiar la cantidad de filas (filtro) no rompe el render y las filas siguen navegando', async () => {
    // BUG-1: la navegación por fila se resuelve en <ProductoFila>, un componente por
    // fila, en vez de llamar el helper dentro de items.map() (patrón que viola
    // rules-of-hooks y es una trampa latente si el helper pasa a usar hooks reales).
    // Este test es la red de regresión de esa refactor: al cambiar la cantidad de
    // filas entre renders, el listado sigue montándose bien y las filas navegan.
    mockList.mockImplementation((args: any) =>
      args?.activo === false
        ? Promise.resolve({ items: [PRODUCTS[0]], total: 1 })
        : Promise.resolve({ items: PRODUCTS, total: 2 }),
    );

    renderView();
    await screen.findByText('Taladro');
    expect(screen.getByText('Sierra')).toBeInTheDocument();

    // Filtro de estado → "Inactivos": el IPC ahora devuelve 1 sola fila.
    const estadoSelect = screen.getByRole('option', { name: 'Inactivos' }).closest('select')!;
    fireEvent.change(estadoSelect, { target: { value: 'false' } });

    await waitFor(() => expect(screen.queryByText('Sierra')).toBeNull());
    const row = screen.getByText('Taladro').closest('tr')!;
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });
});
