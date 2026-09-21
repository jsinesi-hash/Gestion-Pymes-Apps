import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmarVentaModal } from '../ConfirmarVentaModal';
import type { MedioPago, VentaPagoPayload } from '../../../hooks/usePosSession';

const totales = {
  subtotalCentavos: 100000,
  descuentoGlobalCentavos: 0,
  totalCentavos: 100000,
  ajusteRedondeoCentavos: 0,
};

function renderModal(overrides: {
  formaPago?: MedioPago;
  habilitaCcc?: boolean;
  onConfirmar?: (pagos: VentaPagoPayload[], vuelto: number | null) => void;
  onVolver?: () => void;
} = {}) {
  return render(
    <ConfirmarVentaModal
      totales={totales}
      formaPagoDefault={overrides.formaPago ?? 'efectivo'}
      habilitaCcc={overrides.habilitaCcc ?? false}
      loading={false}
      onConfirmar={overrides.onConfirmar ?? vi.fn()}
      onVolver={overrides.onVolver ?? vi.fn()}
    />,
  );
}

describe('ConfirmarVentaModal', () => {
  it('campo monto tiene step=1', () => {
    renderModal();
    const input = screen.getByLabelText(/monto/i);
    expect(input).toHaveAttribute('step', '1');
  });

  it('muestra el total a pagar', () => {
    renderModal();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
  });

  it('Volver llama onVolver sin llamar onConfirmar', () => {
    const onV = vi.fn();
    const onC = vi.fn();
    renderModal({ onVolver: onV, onConfirmar: onC });
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(onV).toHaveBeenCalled();
    expect(onC).not.toHaveBeenCalled();
  });

  it('Confirmar deshabilitado cuando monto es 0', () => {
    renderModal({ formaPago: 'efectivo' });
    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled();
  });

  it('Confirmar habilitado cuando pago cubre el total', () => {
    renderModal({ formaPago: 'efectivo' });
    const input = screen.getByLabelText(/monto/i);
    fireEvent.change(input, { target: { value: '1000' } });
    expect(screen.getByRole('button', { name: /^confirmar$/i })).not.toBeDisabled();
  });

  it('vuelto se muestra en vivo cuando efectivo supera el total', () => {
    renderModal({ formaPago: 'efectivo' });
    const input = screen.getByLabelText(/monto/i);
    fireEvent.change(input, { target: { value: '1200' } });
    expect(screen.getByText(/vuelto/i)).toBeInTheDocument();
    expect(screen.getByText(/200,00/)).toBeInTheDocument();
  });

  it('Confirmar llama onConfirmar con pagos y vuelto correctos', () => {
    const onC = vi.fn();
    renderModal({ formaPago: 'efectivo', onConfirmar: onC });
    const input = screen.getByLabelText(/monto/i);
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(onC).toHaveBeenCalledWith(
      [expect.objectContaining({ medio_pago: 'efectivo', monto_centavos: 100000 })],
      null,
    );
  });

  it('preselecciona el formaPagoDefault recibido como tarjeta', () => {
    renderModal({ formaPago: 'tarjeta' });
    expect(screen.getByDisplayValue(/tarjeta/i)).toBeInTheDocument();
  });

  it('se puede agregar un segundo medio de pago', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /agregar medio/i }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('se puede eliminar un medio de pago si hay más de uno', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /agregar medio/i }));
    const botonesBorrar = screen.getAllByRole('button', { name: /quitar/i });
    expect(botonesBorrar).toHaveLength(2);
    fireEvent.click(botonesBorrar[0]);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('la segunda fila no ofrece el medio ya usado por la primera (sin duplicados)', () => {
    renderModal({ formaPago: 'efectivo' });
    fireEvent.click(screen.getByRole('button', { name: /agregar medio/i }));
    const selects = screen.getAllByRole('combobox');
    // La fila nueva arranca en el primer medio libre (no 'efectivo', ya usado por la fila 1).
    expect((selects[1] as HTMLSelectElement).value).not.toBe('efectivo');
    const opcionesFila2 = Array.from((selects[1] as HTMLSelectElement).options).map(o => o.value);
    expect(opcionesFila2).not.toContain('efectivo');
  });

  it('deshabilita "Agregar medio" cuando todos los medios están en uso', () => {
    renderModal({ habilitaCcc: true }); // 5 medios disponibles
    const agregar = screen.getByRole('button', { name: /agregar medio/i });
    // efectivo (inicial) + tarjeta + transferencia + cuenta_corriente + cheque = 5
    for (let i = 0; i < 4; i++) fireEvent.click(agregar);
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
    expect(agregar).toBeDisabled();
  });

  it('llama a onVolver al presionar Escape', () => {
    const onVolver = vi.fn();
    renderModal({ onVolver });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onVolver).toHaveBeenCalledOnce();
  });
});
