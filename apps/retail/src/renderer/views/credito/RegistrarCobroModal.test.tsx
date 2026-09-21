import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistrarCobroModal } from './RegistrarCobroModal';

const registrarCobro = vi.fn();

beforeEach(() => {
  registrarCobro.mockReset();
  (globalThis as any).ferreteria = { ctacte: { registrarCobro } };
});

function renderModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  render(
    <RegistrarCobroModal cuentaId="c1" saldoActual={50000} onClose={onClose} onSuccess={onSuccess} />,
  );
}

describe('RegistrarCobroModal', () => {
  it('registra el cobro con los datos cargados', async () => {
    registrarCobro.mockResolvedValue({ saldo_centavos: 40000 });
    const onSuccess = vi.fn();
    renderModal(onSuccess);

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => expect(registrarCobro).toHaveBeenCalledWith(expect.objectContaining({
      cuentaId: 'c1', monto_centavos: 10000, forma_pago: 'efectivo',
    })));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('no deja confirmar con monto vacío', async () => {
    renderModal();
    expect(screen.getByRole('button', { name: /confirmar cobro/i })).toBeDisabled();
    expect(registrarCobro).not.toHaveBeenCalled();
  });

  it('rutea el error de validación del backend al campo monto_centavos', async () => {
    registrarCobro.mockRejectedValue(new Error('VALIDATION:monto_centavos:NEGATIVO'));
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('monto_centavos')));
    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
  });

  it('rutea el error de validación del backend al campo forma_pago', async () => {
    registrarCobro.mockRejectedValue(new Error('VALIDATION:forma_pago:ENUM'));
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('forma_pago')));
    expect(await screen.findByText(/no es válido/i)).toBeInTheDocument();
  });

  it('muestra un error general (no ruteable a un campo) cuando falta caja abierta', async () => {
    registrarCobro.mockRejectedValue(new Error('CAJA_NO_ABIERTA'));
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cobro/i }));

    expect(await screen.findByText(/no hay una caja abierta/i)).toBeInTheDocument();
  });
});
