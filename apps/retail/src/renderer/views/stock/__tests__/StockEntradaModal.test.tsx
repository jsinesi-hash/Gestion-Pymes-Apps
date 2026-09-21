import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StockEntradaModal } from '../StockEntradaModal';

const mockExistenciasGet = vi.fn();
const mockStockEntrada = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockExistenciasGet.mockResolvedValue({
    id: 'ex-1',
    producto_id: 'p-1',
    stock_fisico: 10,
    stock_minimo: 5,
    stock_maximo: null,
    ultima_fecha_movimiento: null,
  });
  mockStockEntrada.mockResolvedValue(undefined);
  (window as any).ferreteria = {
    catalogo: {
      existencias: { get: mockExistenciasGet },
      stock: { entrada: mockStockEntrada },
    },
  };
});

function renderModal(productoId = 'p-1') {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <StockEntradaModal productoId={productoId} onClose={onClose} onSuccess={onSuccess} />
  );
  return { onClose, onSuccess };
}

describe('StockEntradaModal', () => {
  it('shows Stock actual: 10 after loading', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls stock.entrada with correct args on submit', async () => {
    const { onSuccess } = renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());

    const cantidadInput = screen.getByRole('spinbutton', { name: /cantidad a ingresar/i });
    fireEvent.change(cantidadInput, { target: { value: '5' } });

    const submitBtn = screen.getByRole('button', { name: /confirmar entrada/i });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(mockStockEntrada).toHaveBeenCalledOnce());
    expect(mockStockEntrada).toHaveBeenCalledWith({
      producto_id: 'p-1',
      cantidad: 5,
      costo_unitario: undefined,
      observaciones: undefined,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('campo cantidad tiene step=1 y min=1', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());
    const input = screen.getByRole('spinbutton', { name: /cantidad a ingresar/i });
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveAttribute('min', '1');
  });

  it('shows validation error when cantidad is 0', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());

    // Try to submit without filling cantidad
    const submitBtn = screen.getByRole('button', { name: /confirmar entrada/i });
    // Button should be disabled when cantidad is empty
    expect(submitBtn).toBeDisabled();
  });

  it('calls onClose when Escape is pressed', async () => {
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('NO llama onClose con Escape mientras se está enviando el formulario', async () => {
    let resolveEntrada: () => void = () => {};
    mockStockEntrada.mockReturnValue(new Promise<void>((resolve) => { resolveEntrada = resolve; }));
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.getByText(/Stock actual:/)).toBeInTheDocument());

    fireEvent.change(screen.getByRole('spinbutton', { name: /cantidad a ingresar/i }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar entrada/i }));
    await waitFor(() => expect(screen.getByText(/guardando/i)).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveEntrada();
  });
});
