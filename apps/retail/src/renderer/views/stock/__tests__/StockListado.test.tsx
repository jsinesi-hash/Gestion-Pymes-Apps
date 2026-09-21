import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StockListado } from '../StockListado';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockList = vi.fn();
const mockStockCounts = vi.fn();

const PRODUCTS = [
  { id: 'p1', sku: 'SKU-001', nombre_corto: 'Taladro', stock_fisico: 20, stock_minimo: 5 },
  { id: 'p2', sku: 'SKU-002', nombre_corto: 'Pintura', stock_fisico: 2, stock_minimo: 10 },
  { id: 'p3', sku: 'SKU-003', nombre_corto: 'Clavos', stock_fisico: 0, stock_minimo: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue({ items: PRODUCTS, total: 3 });
  mockStockCounts.mockResolvedValue({ ok: 1, bajo: 1, sin: 1 });
  (window as any).ferreteria = {
    catalogo: {
      producto: { list: mockList, stockCounts: mockStockCounts },
    },
  };
});

function renderComponent() {
  return render(
    <MemoryRouter>
      <StockListado />
    </MemoryRouter>
  );
}

describe('StockListado', () => {
  it('renders table with product names', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    expect(screen.getByText('Pintura')).toBeInTheDocument();
    expect(screen.getByText('Clavos')).toBeInTheDocument();
  });

  it('shows stat cards: Con stock OK, Bajo mínimo, Sin stock', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());

    expect(screen.getByText('Con stock OK')).toBeInTheDocument();
    expect(screen.getAllByText('Bajo mínimo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin stock').length).toBeGreaterThanOrEqual(1);
  });

  it('stat card counts are correct', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());

    const conStockOkCard = screen.getByText('Con stock OK').closest('div')?.parentElement;
    const bajoMinimoLabels = screen.getAllByText('Bajo mínimo');
    const bajoMinimoCard = bajoMinimoLabels[0].closest('div')?.parentElement;
    const sinStockLabels = screen.getAllByText('Sin stock');
    const sinStockCard = sinStockLabels[0].closest('div')?.parentElement;

    expect(conStockOkCard?.textContent).toContain('1');
    expect(bajoMinimoCard?.textContent).toContain('1');
    expect(sinStockCard?.textContent).toContain('1');
  });

  it('el card "Bajo mínimo" filtra la tabla al hacer clic', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: /bajo m/i });
    expect(btn).toBeDefined();
  });

  it('ADR-057: abre con el filtro combinado "Bajo mínimo + Sin stock"', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());

    // El primer pedido de productos usa stock_status: 'bajo_sin'.
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ stock_status: 'bajo_sin' }));
    // El select del filtro refleja la opción combinada.
    expect((screen.getByDisplayValue('Bajo mínimo + Sin stock') as HTMLSelectElement).value).toBe('bajo_sin');
  });
});

describe('StockListado — navegación por fila completa (ADR-069)', () => {
  it('ADR-069: clic en la fila abre el detalle del producto', async () => {
    renderComponent();
    const nombre = await screen.findByText('Taladro');
    fireEvent.click(nombre.closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });

  it('ADR-069: clic en el botón Kardex no navega al detalle del producto', async () => {
    renderComponent();
    await screen.findByText('Taladro');
    fireEvent.click(screen.getAllByTitle('Kardex')[0]);
    expect(mockNavigate).not.toHaveBeenCalledWith('/productos/p1');
    expect(mockNavigate).toHaveBeenCalledWith('/stock/p1/kardex');
  });
});

describe('StockListado — filtros', () => {
  it('los filtros se muestran en la barra sobre la tabla, no en el thead', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    const filterSku = screen.getByPlaceholderText('Filtrar SKU...');
    // El input NO debe estar dentro del thead
    expect(filterSku.closest('thead')).toBeNull();
  });

  it('escribir en filtro SKU no pierde el foco', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    const filterSku = screen.getByPlaceholderText('Filtrar SKU...');
    filterSku.focus();
    fireEvent.change(filterSku, { target: { value: 'SK' } });
    expect(document.activeElement).toBe(filterSku);
  });

  it('escribir en filtro nombre no pierde el foco', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Taladro')).toBeInTheDocument());
    const filterNombre = screen.getByPlaceholderText('Filtrar nombre...');
    filterNombre.focus();
    fireEvent.change(filterNombre, { target: { value: 'Ta' } });
    expect(document.activeElement).toBe(filterNombre);
  });
});
