import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductoForm } from './ProductoForm';
import { ToastProvider } from '@core/ui';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({}) };
});

vi.mock('../../hooks/useProducto', () => ({ useProducto: () => ({ producto: null }) }));
vi.mock('../../hooks/useCategorias', () => ({ useCategorias: () => [{ id: 'c1', nombre: 'Herramientas' }] }));
vi.mock('../../hooks/useMarcas', () => ({ useMarcas: () => ({ marcas: [], createMarca: vi.fn() }) }));
vi.mock('../../hooks/useImpuestos', () => ({ useImpuestos: () => [{ id: 'i1', nombre: 'IVA 21%' }] }));
vi.mock('../../hooks/useUbicaciones', () => ({ useUbicaciones: () => [] }));
vi.mock('../../hooks/useUnidades', () => ({ useUnidades: () => [{ id: 'u1', nombre: 'Unidad', abreviatura: 'un' }] }));
vi.mock('@core/ui', async (orig) => ({ ...(await orig<any>()), useEscapeToClose: () => {} }));

const mockCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = { catalogo: { producto: { create: mockCreate, update: vi.fn() } } };
});

function renderForm() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ProductoForm />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function completarRequeridos() {
  fireEvent.change(screen.getByTestId('nombre_corto'), { target: { value: 'Taladro' } });
  fireEvent.change(screen.getByTestId('categoria_id'), { target: { value: 'c1' } });
  fireEvent.change(screen.getByTestId('impuesto_id'), { target: { value: 'i1' } });
  fireEvent.change(screen.getByTestId('unidad_venta'), { target: { value: 'un' } });
  fireEvent.change(screen.getByTestId('precio_venta_lista'), { target: { value: '1500' } });
}

describe('ProductoForm — PROD-1: validación inline', () => {
  it('submit vacío muestra mensajes específicos, no "Requerido"', () => {
    renderForm();
    fireEvent.submit(screen.getByTestId('producto-form'));
    expect(screen.getByText('Ingresá un nombre')).toBeInTheDocument();
    expect(screen.queryByText('Requerido')).toBeNull();
  });

  it('al fallar el submit el foco va al primer campo inválido', () => {
    renderForm();
    fireEvent.submit(screen.getByTestId('producto-form'));
    expect(screen.getByTestId('nombre_corto')).toHaveFocus();
  });

  it('salir de un campo requerido vacío muestra su mensaje (onBlur)', () => {
    renderForm();
    fireEvent.blur(screen.getByTestId('nombre_corto'));
    expect(screen.getByText('Ingresá un nombre')).toBeInTheDocument();
  });

  it('precio 0 pide un precio mayor a 0', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('precio_venta_lista'), { target: { value: '0' } });
    fireEvent.submit(screen.getByTestId('producto-form'));
    expect(screen.getByText('Ingresá un precio mayor a 0')).toBeInTheDocument();
  });
});

describe('ProductoForm — ERR-1: no más guardado silencioso', () => {
  it('si el create falla, muestra el error traducido y NO navega', async () => {
    mockCreate.mockRejectedValue(new Error('UNIQUE constraint failed: producto.gtin_barcode'));
    renderForm();
    completarRequeridos();
    fireEvent.submit(screen.getByTestId('producto-form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/código de barras/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ADR-082: si el backend rechaza por validación de un campo, lo pinta inline y lo enfoca', async () => {
    mockCreate.mockRejectedValue(new Error('VALIDATION:nombre_corto:REQUERIDO'));
    renderForm();
    completarRequeridos();
    fireEvent.submit(screen.getByTestId('producto-form'));
    const input = screen.getByTestId('nombre_corto');
    await waitFor(() => {
      const field = input.closest('.field') as HTMLElement;
      expect(within(field).getByText(/obligatorio|requerido/i)).toBeInTheDocument();
    });
    expect(input).toHaveFocus();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('si el create sale bien, navega al detalle del nuevo producto', async () => {
    mockCreate.mockResolvedValue({ id: 'p-new' });
    renderForm();
    completarRequeridos();
    fireEvent.submit(screen.getByTestId('producto-form'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/productos/p-new'));
  });
});

describe('ProductoForm — PROD-2: stock inicial en el alta', () => {
  it('con cantidad y costo cargados, el create incluye stock_inicial', async () => {
    mockCreate.mockResolvedValue({ id: 'p-new' });
    renderForm();
    completarRequeridos();
    fireEvent.change(screen.getByTestId('stock_inicial_cantidad'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('stock_inicial_costo'), { target: { value: '300' } });
    fireEvent.submit(screen.getByTestId('producto-form'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ stock_inicial: { cantidad: 10, costo: 300 } }),
    );
  });

  it('sin cargar stock inicial, el create no incluye stock_inicial', async () => {
    mockCreate.mockResolvedValue({ id: 'p-new' });
    renderForm();
    completarRequeridos();
    fireEvent.submit(screen.getByTestId('producto-form'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('stock_inicial');
  });

  it('con solo cantidad cargada (sin costo), el create incluye stock_inicial sin costo', async () => {
    mockCreate.mockResolvedValue({ id: 'p-new' });
    renderForm();
    completarRequeridos();
    fireEvent.change(screen.getByTestId('stock_inicial_cantidad'), { target: { value: '7' } });
    fireEvent.submit(screen.getByTestId('producto-form'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.stock_inicial).toEqual({ cantidad: 7 });
    expect(arg.stock_inicial).not.toHaveProperty('costo');
  });
});
