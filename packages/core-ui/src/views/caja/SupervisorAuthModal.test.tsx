import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupervisorAuthModal } from './SupervisorAuthModal';

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockOnConfirm.mockResolvedValue(undefined);
});

async function autorizarConError(err: unknown) {
  mockOnConfirm.mockRejectedValue(err);
  render(<SupervisorAuthModal onConfirm={mockOnConfirm} onCancel={mockOnCancel} />);
  fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));
  return screen.findByRole('alert');
}

describe('SupervisorAuthModal — traducción de errores', () => {
  it('SUPERVISOR_INVALIDO exacto → mensaje unificado', async () => {
    const alert = await autorizarConError(new Error('SUPERVISOR_INVALIDO'));
    expect(alert).toHaveTextContent('Usuario o contraseña incorrectos, o no es Supervisor.');
  });

  it('SUPERVISOR_INVALIDO envuelto por Electron → el mismo mensaje unificado', async () => {
    const alert = await autorizarConError(
      new Error("Error invoking remote method 'venta:anular': Error: SUPERVISOR_INVALIDO"),
    );
    expect(alert).toHaveTextContent('Usuario o contraseña incorrectos, o no es Supervisor.');
  });

  it('otro código de dominio envuelto → mensaje traducido, no la cadena técnica', async () => {
    const alert = await autorizarConError(
      new Error("Error invoking remote method 'venta:anular': Error: VENTA_YA_ANULADA"),
    );
    expect(alert).toHaveTextContent('La venta ya estaba anulada.');
    expect(alert).not.toHaveTextContent(/invoking remote method/i);
  });

  it('el modal queda abierto y habilitado para reintentar', async () => {
    await autorizarConError(new Error('SUPERVISOR_INVALIDO'));
    await waitFor(() => expect(screen.getByRole('button', { name: /autorizar/i })).toBeEnabled());
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
