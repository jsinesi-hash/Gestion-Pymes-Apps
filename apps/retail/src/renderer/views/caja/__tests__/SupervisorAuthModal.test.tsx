import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupervisorAuthModal } from '@core/ui';

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockOnConfirm.mockResolvedValue(undefined);
});

describe('SupervisorAuthModal', () => {
  it('renderiza campos usuario y contraseña y botones', () => {
    render(<SupervisorAuthModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña supervisor/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /autorizar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('llama onConfirm con usuario y password ingresados', async () => {
    render(<SupervisorAuthModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));
    await waitFor(() =>
      expect(mockOnConfirm).toHaveBeenCalledWith({ nombre_usuario: 'admin', password: 'admin1234' })
    );
  });

  it('llama onCancel al cancelar', () => {
    render(<SupervisorAuthModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it('muestra error amigable cuando onConfirm lanza SUPERVISOR_INVALIDO', async () => {
    mockOnConfirm.mockRejectedValue(new Error('SUPERVISOR_INVALIDO'));
    render(<SupervisorAuthModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));
    await waitFor(() =>
      expect(screen.getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument()
    );
  });
});
