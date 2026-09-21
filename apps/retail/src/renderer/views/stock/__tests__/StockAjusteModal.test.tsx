import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StockAjusteModal } from '../StockAjusteModal';

const mockExistenciasGet = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockExistenciasGet.mockResolvedValue({
    id: 'ex-1',
    producto_id: 'p-1',
    stock_fisico: 149.9,
    stock_minimo: 0,
    stock_maximo: null,
    ultima_fecha_movimiento: null,
  });
  (window as any).ferreteria = {
    catalogo: {
      existencias: { get: mockExistenciasGet },
      stock: { ajuste: vi.fn() },
    },
  };
});

describe('StockAjusteModal', () => {
  it('shows the delta rounded, not raw floating point error', async () => {
    render(<StockAjusteModal productoId="p-1" onSuccess={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('149.9')).toBeInTheDocument());

    const input = screen.getByLabelText(/Cantidad contada/i);
    fireEvent.change(input, { target: { value: '145' } });

    await waitFor(() => expect(screen.getByText(/-4,9\s/)).toBeInTheDocument());
    expect(screen.queryByText(/-4,900000000000006/)).not.toBeInTheDocument();
  });
});
