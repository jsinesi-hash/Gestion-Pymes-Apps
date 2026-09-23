import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AperturaForm } from '@core/ui';
import { ToastProvider } from '@core/ui';

const mockAbrir = vi.fn();
const mockOnSuccess = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockAbrir.mockResolvedValue({ id: 'caja-1', estado: 'abierta', monto_inicial: 5000 });
  (window as any).ferreteria = { caja: { abrir: mockAbrir } };
});

describe('AperturaForm', () => {
  it('renders monto inicial input and submit button', () => {
    render(<AperturaForm onSuccess={mockOnSuccess} />);
    expect(screen.getByLabelText(/monto inicial/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir caja/i })).toBeInTheDocument();
  });

  it('submit button disabled when monto is 0', () => {
    render(<AperturaForm onSuccess={mockOnSuccess} />);
    expect(screen.getByRole('button', { name: /abrir caja/i })).toBeDisabled();
  });

  it('calls caja.abrir with monto_inicial and invokes onSuccess', async () => {
    render(<AperturaForm onSuccess={mockOnSuccess} />);
    fireEvent.change(screen.getByLabelText(/monto inicial/i), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    await waitFor(() => expect(mockAbrir).toHaveBeenCalledWith({ monto_inicial: 5000, observaciones: undefined }));
    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledOnce());
  });

  it('muestra un toast de éxito al abrir la caja (ADR-082)', async () => {
    render(<ToastProvider><AperturaForm onSuccess={mockOnSuccess} /></ToastProvider>);
    fireEvent.change(screen.getByLabelText(/monto inicial/i), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    await waitFor(() => expect(screen.getByText('Caja abierta')).toBeInTheDocument());
  });

  it('muestra un error traducido cuando caja.abrir falla (ADR-082)', async () => {
    mockAbrir.mockRejectedValue(new Error('ALREADY_OPEN'));
    render(<AperturaForm onSuccess={mockOnSuccess} />);
    fireEvent.change(screen.getByLabelText(/monto inicial/i), {
      target: { value: '1000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir caja/i }));
    // SEC-2: el error crudo ya no se muestra literal; se traduce a un mensaje humano
    // en el alert (aquí, mensaje genérico por no estar en el catálogo).
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/ALREADY_OPEN/i)).not.toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('muestra valor formateado al perder foco', () => {
    render(<AperturaForm onSuccess={mockOnSuccess} />);
    const input = screen.getByLabelText(/monto inicial/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    // Valor formateado: "$ 5.000,00" (es-AR)
    expect(input.value).toMatch(/\$ [\d.,]+/);
  });
});
