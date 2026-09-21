import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosItemsTable } from '../PosItemsTable';
import type { PosLine, PresentacionOpcion } from '../../../hooks/usePosSession';

const mockLine = {
  producto_id: 'p-1',
  descripcion: 'Tornillo',
  cantidad: 2,
  precioListaCentavos: 100000,
  ajustePct: 0,
  descuentoLineaPct: 0,
  alicuota_iva: 21,
  permite_fraccion: false,
  stock_fisico: 10,
  precioOrigen: 'vigente' as const,
};

function renderTable(overrides: Partial<typeof mockLine> = {}, canOverride = false) {
  const onCantidad = vi.fn();
  const onDescuentoLinea = vi.fn();
  const onRemove = vi.fn();
  const line = { ...mockLine, ...overrides };
  render(
    <PosItemsTable
      lines={[line]}
      onCantidad={onCantidad}
      onDescuentoLinea={onDescuentoLinea}
      onRemove={onRemove}
      canOverride={canOverride}
    />,
  );
  return { onCantidad, onDescuentoLinea, onRemove };
}

describe('PosItemsTable – cantidad editable', () => {
  it('muestra la cantidad en un input editable', () => {
    renderTable({ cantidad: 2 });
    const input = screen.getByRole('spinbutton', { name: /cantidad/i }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('2');
  });

  it('tipear cantidad actualiza el valor', () => {
    const { onCantidad } = renderTable();
    const input = screen.getByRole('spinbutton', { name: /cantidad/i });
    fireEvent.change(input, { target: { value: '5' } });
    expect(onCantidad).toHaveBeenCalledWith('p-1', 5);
  });

  it('tipear 0 o vacío no llama a onCantidad con valor inválido', () => {
    const { onCantidad } = renderTable();
    const input = screen.getByRole('spinbutton', { name: /cantidad/i });
    fireEvent.change(input, { target: { value: '0' } });
    // Implementation resets 0 to 1
    expect(onCantidad).toHaveBeenCalledWith('p-1', 1);
  });

  it('tipear vacío no llama a onCantidad con valor inválido', () => {
    const { onCantidad } = renderTable();
    const input = screen.getByRole('spinbutton', { name: /cantidad/i });
    fireEvent.change(input, { target: { value: '' } });
    expect(onCantidad).not.toHaveBeenCalledWith('p-1', 0);
    expect(onCantidad).not.toHaveBeenCalledWith('p-1', NaN);
  });

  it('tipear decimal para producto sin fracción redondea a entero', () => {
    const { onCantidad } = renderTable({ permite_fraccion: false });
    const input = screen.getByRole('spinbutton', { name: /cantidad/i });
    fireEvent.change(input, { target: { value: '2.5' } });
    // Should round to 3 (or 2) — either way, not 2.5
    expect(onCantidad).toHaveBeenCalled();
    expect(Number.isInteger(onCantidad.mock.calls[0][1])).toBe(true);
  });

  it('los botones +/- siguen funcionando', () => {
    const { onCantidad } = renderTable({ cantidad: 2 });
    const plusBtn = screen.getByRole('button', { name: /aumentar cantidad/i });
    const minusBtn = screen.getByRole('button', { name: /disminuir cantidad/i });

    fireEvent.click(plusBtn);
    expect(onCantidad).toHaveBeenCalledWith('p-1', 3);

    fireEvent.click(minusBtn);
    expect(onCantidad).toHaveBeenCalledWith('p-1', 1);
  });
});

// AUD-20260723-001 / Lote 1 A.4 — `line.presentaciones` es opcional en PosLine (ADR-040:
// las líneas de ventas previas a la multi-presentación no lo traen). El selector se dibuja
// sólo cuando hay más de una presentación, pero el narrowing del JSX no alcanza al callback
// del onChange, así que el acceso adentro tiene que ser opcional. Estos casos fijan las dos
// mitades: que la línea sin presentaciones no rompa ni dibuje combo, y que la línea con
// presentaciones siga notificando el cambio.
describe('PosItemsTable – selector de presentación (ADR-040)', () => {
  const presentaciones: PresentacionOpcion[] = [
    { id: 'pp-1', unidad_abreviatura: 'un', factor_a_stock: 1.0, es_default: true },
    { id: 'pp-2', unidad_abreviatura: 'caja', factor_a_stock: 100.0, es_default: false },
  ];

  function renderConPresentacion(overrides: Partial<PosLine>) {
    const onPresentacion = vi.fn();
    const line: PosLine = { ...mockLine, ...overrides };
    render(
      <PosItemsTable
        lines={[line]}
        onCantidad={vi.fn()}
        onDescuentoLinea={vi.fn()}
        onRemove={vi.fn()}
        onPresentacion={onPresentacion}
        canOverride={false}
      />,
    );
    return { onPresentacion };
  }

  it('una línea sin presentaciones se renderiza sin combo y sin romper', () => {
    // `mockLine` no trae la clave `presentaciones`: con exactOptionalPropertyTypes,
    // omitirla es lo que representa "ausente", no pasarla como undefined.
    renderConPresentacion({});
    expect(screen.getByText('Tornillo')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('una línea con una sola presentación tampoco dibuja el combo', () => {
    renderConPresentacion({ presentaciones: [presentaciones[0]], presentacion_id: 'pp-1' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('con dos presentaciones dibuja el combo y notifica el cambio con el factor', () => {
    const { onPresentacion } = renderConPresentacion({ presentaciones, presentacion_id: 'pp-1' });
    const combo = screen.getByRole('combobox');
    fireEvent.change(combo, { target: { value: 'pp-2' } });
    expect(onPresentacion).toHaveBeenCalledWith('p-1', 'pp-2', 100.0, 'caja');
  });

  it('elegir un id que no está en la lista no notifica nada', () => {
    const { onPresentacion } = renderConPresentacion({ presentaciones, presentacion_id: 'pp-1' });
    const combo = screen.getByRole('combobox');
    fireEvent.change(combo, { target: { value: 'pp-inexistente' } });
    expect(onPresentacion).not.toHaveBeenCalled();
  });
});
