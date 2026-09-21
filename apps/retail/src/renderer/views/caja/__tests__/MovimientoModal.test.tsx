import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MovimientoModal } from '../MovimientoModal';

const mockAddMovimiento = vi.fn();
const mockOnClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockAddMovimiento.mockResolvedValue({ id: 'mov-1' });
  (window as any).ferreteria = { caja: { addMovimiento: mockAddMovimiento } };
});

describe('MovimientoModal', () => {
  it('renders fields and submit button', () => {
    render(<MovimientoModal cajaId="caja-1" onClose={mockOnClose} />);
    expect(screen.getByRole('combobox', { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /motivo/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /monto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
  });

  it('calls addMovimiento and closes on confirm', async () => {
    render(<MovimientoModal cajaId="caja-1" onClose={mockOnClose} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /monto/i }), {
      target: { value: '1000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => expect(mockAddMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({ caja_id: 'caja-1', monto: 1000 })
    ));
    await waitFor(() => expect(mockOnClose).toHaveBeenCalledOnce());
  });

  it('shows a translated error when addMovimiento fails (ADR-082)', async () => {
    mockAddMovimiento.mockRejectedValue(new Error('CAJA_NO_ABIERTA'));
    render(<MovimientoModal cajaId="caja-1" onClose={mockOnClose} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /monto/i }), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    // SEC-2: el código crudo se traduce a un mensaje humano en el alert.
    await waitFor(() => expect(screen.getByText('No hay una caja abierta.')).toBeInTheDocument());
    expect(screen.queryByText(/CAJA_NO_ABIERTA/)).not.toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('cancel button calls onClose', () => {
    render(<MovimientoModal cajaId="caja-1" onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    render(<MovimientoModal cajaId="caja-1" onClose={mockOnClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});
