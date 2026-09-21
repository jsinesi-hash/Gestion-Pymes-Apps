import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnulacionModal } from '../AnulacionModal';

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    venta: { anular: vi.fn().mockResolvedValue({}) },
  };
});

describe('AnulacionModal', () => {
  it('renderiza campo motivo, usuario supervisor y contraseña supervisor', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/motivo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña supervisor/i)).toBeInTheDocument();
  });

  it('llama onCancel al clickar Cancelar', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('llama venta:anular con motivo y credenciales y luego onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={onSuccess} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: 'Error de precio' } });
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /anular venta/i }));

    await waitFor(() => expect((window as any).ferreteria.venta.anular).toHaveBeenCalledWith({
      venta_id: 'v-1',
      motivo: 'Error de precio',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('muestra error si motivo está vacío', async () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /anular venta/i }));
    expect(screen.getByText(/el motivo es obligatorio/i)).toBeInTheDocument();
    expect((window as any).ferreteria.venta.anular).not.toHaveBeenCalled();
  });

  it('muestra error de supervisor inválido del backend', async () => {
    (window as any).ferreteria.venta.anular = vi.fn().mockRejectedValue(new Error('SUPERVISOR_INVALIDO'));
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: 'Motivo' } });
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /anular venta/i }));
    await waitFor(() => expect(screen.getByText(/usuario o contraseña de supervisor incorrectos/i)).toBeInTheDocument());
  });

  it('llama onCancel al presionar Escape', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
