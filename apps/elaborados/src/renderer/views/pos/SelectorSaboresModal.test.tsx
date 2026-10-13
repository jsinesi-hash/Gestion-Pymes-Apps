import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatPesos } from '@core/ui';
import { SelectorSaboresModal } from './SelectorSaboresModal';
import type { ProductoPos } from './tipos';

const mk = (min: number, max: number): ProductoPos => ({
  id: 'p-pote', nombre: 'Pote 1/4', categoria_venta_id: 'c1', precio_centavos: 150000,
  grupos: [{ grupo_modificador_id: 'g1', nombre: 'Sabores', min, max, cantidad_total: 0.25, modo_descuento: 'reparto',
    opciones: [
      { id: 'o-choco', nombre: 'Chocolate', recargo_centavos: 0 },
      { id: 'o-ddl', nombre: 'DDL', recargo_centavos: 20000 },
      { id: 'o-fru', nombre: 'Frutilla', recargo_centavos: 0 },
      { id: 'o-van', nombre: 'Vainilla', recargo_centavos: 0 },
    ] }],
});
const agregar = () => screen.getByRole('button', { name: /Agregar/ });
const chip = (n: string) => screen.getByRole('button', { name: new RegExp(n) });

describe('SelectorSaboresModal', () => {
  it('muestra producto, rango y chips con recargo', () => {
    render(<SelectorSaboresModal producto={mk(1, 3)} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.getByText('Pote 1/4')).toBeInTheDocument();
    expect(screen.getByText(/Elegí 1 a 3/)).toBeInTheDocument();
    expect(chip('Chocolate')).toBeInTheDocument();
    expect(chip('DDL').textContent).toContain(`+ ${formatPesos(20000)}`);
  });

  it('Agregar deshabilitado sin selección; confirma con lo elegido', () => {
    const onConfirmar = vi.fn();
    render(<SelectorSaboresModal producto={mk(1, 3)} onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    expect(agregar()).toBeDisabled();
    fireEvent.click(chip('Chocolate'));
    expect(agregar()).toBeEnabled();
    fireEvent.click(agregar());
    expect(onConfirmar).toHaveBeenCalledWith([{ grupo_modificador_id: 'g1', opcion_ids: ['o-choco'] }]);
  });

  it('al llegar al max deshabilita el resto y volver a tocar des-elige', () => {
    render(<SelectorSaboresModal producto={mk(1, 3)} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    fireEvent.click(chip('Chocolate'));
    fireEvent.click(chip('DDL'));
    fireEvent.click(chip('Frutilla'));
    expect(chip('Vainilla')).toBeDisabled();
    fireEvent.click(chip('Frutilla'));
    expect(chip('Frutilla')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Vainilla')).toBeEnabled();
  });

  it('con max 1 elegir otro reemplaza al anterior', () => {
    const onConfirmar = vi.fn();
    render(<SelectorSaboresModal producto={mk(1, 1)} onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    fireEvent.click(chip('Chocolate'));
    fireEvent.click(chip('Frutilla'));
    expect(chip('Chocolate')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(agregar());
    expect(onConfirmar).toHaveBeenCalledWith([{ grupo_modificador_id: 'g1', opcion_ids: ['o-fru'] }]);
  });

  it('min 2 mantiene Agregar deshabilitado con 1 elegido', () => {
    render(<SelectorSaboresModal producto={mk(2, 3)} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    fireEvent.click(chip('Chocolate'));
    expect(agregar()).toBeDisabled();
    fireEvent.click(chip('Frutilla'));
    expect(agregar()).toBeEnabled();
  });

  it('Cancelar y Escape llaman a onCancelar', () => {
    const onCancelar = vi.fn();
    render(<SelectorSaboresModal producto={mk(1, 3)} onConfirmar={vi.fn()} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelar).toHaveBeenCalledTimes(2);
  });
});
