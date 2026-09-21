import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosBottomBar } from '../PosBottomBar';

const totales = {
  subtotalCentavos: 150000,
  descuentoGlobalCentavos: 0,
  totalCentavos: 150000,
  ajusteRedondeoCentavos: 0,
};

type BarProps = Parameters<typeof PosBottomBar>[0];

function renderBar(overrides: Partial<BarProps> = {}) {
  // Se arma el objeto tipado antes de renderizar: esparcir un Partial<> directamente en
  // el JSX vuelve opcionales todas las props y oculta las que falten.
  const props: BarProps = {
    totales,
    descuentoGlobalPct: 0,
    onDescuentoGlobal: vi.fn(),
    canOverride: false,
    loading: false,
    linesCount: 1,
    error: null,
    onClearError: vi.fn(),
    onConfirmar: vi.fn(),
    onCancelar: vi.fn(),
    cantidadEnEspera: 0,
    onEspera: vi.fn(),
    onAbrirEspera: vi.fn(),
    ...overrides,
  };
  return render(<PosBottomBar {...props} />);
}

describe('PosBottomBar', () => {
  it('muestra el total formateado', () => {
    renderBar();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it('botón Confirmar deshabilitado sin líneas', () => {
    renderBar({ linesCount: 0, totales: null });
    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled();
  });

  it('botón Confirmar habilitado con líneas', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /^confirmar$/i })).not.toBeDisabled();
  });

  it('botón Confirmar llama onConfirmar', () => {
    const onConfirmar = vi.fn();
    renderBar({ onConfirmar });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(onConfirmar).toHaveBeenCalled();
  });

  // ADR-056 Lote 2: botón Cancelar (vuelve el cart a cero, con confirmación en PosView).
  it('botón Cancelar deshabilitado sin líneas', () => {
    renderBar({ linesCount: 0, totales: null });
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeDisabled();
  });

  it('botón Cancelar habilitado con líneas', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).not.toBeDisabled();
  });

  it('botón Cancelar llama onCancelar', () => {
    const onCancelar = vi.fn();
    renderBar({ onCancelar });
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(onCancelar).toHaveBeenCalled();
  });

  it('muestra error STOCK_INSUFICIENTE como texto legible', () => {
    renderBar({ error: 'STOCK_INSUFICIENTE' });
    expect(screen.getByText(/sin stock/i)).toBeInTheDocument();
  });

  it('botón cerrar error llama onClearError', () => {
    const onClear = vi.fn();
    renderBar({ error: 'STOCK_INSUFICIENTE', onClearError: onClear });
    fireEvent.click(screen.getByRole('button', { name: /✕/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('campo descuento global visible sólo con canOverride', () => {
    renderBar({ canOverride: true });
    expect(screen.getByLabelText(/desc.*global/i)).toBeInTheDocument();
  });

  it('campo descuento global oculto sin canOverride', () => {
    renderBar({ canOverride: false });
    expect(screen.queryByLabelText(/desc.*global/i)).not.toBeInTheDocument();
  });
});
