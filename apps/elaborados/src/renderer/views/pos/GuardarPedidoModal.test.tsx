import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuardarPedidoModal } from './GuardarPedidoModal';

const base = { guardando: false, error: null, onGuardar: vi.fn(), onCancelar: vi.fn() };
const guardar = () => screen.getByRole('button', { name: 'Guardar pedido' });
const alias = () => screen.getByLabelText('Alias del pedido');
const obs = () => screen.getByLabelText('Observaciones');

describe('GuardarPedidoModal', () => {
  it('el botón está deshabilitado sin alias', () => {
    render(<GuardarPedidoModal {...base} />);
    expect(guardar()).toBeDisabled();
    fireEvent.change(alias(), { target: { value: '   ' } });
    expect(guardar()).toBeDisabled();
  });

  it('con alias llama a onGuardar con los valores recortados', () => {
    const onGuardar = vi.fn();
    render(<GuardarPedidoModal {...base} onGuardar={onGuardar} />);
    fireEvent.change(alias(), { target: { value: '  Marta  ' } });
    fireEvent.change(obs(), { target: { value: ' Calle 1, 20hs ' } });
    fireEvent.click(guardar());
    expect(onGuardar).toHaveBeenCalledWith({ alias: 'Marta', observaciones: 'Calle 1, 20hs' });
  });

  it('precarga los valores iniciales', () => {
    render(<GuardarPedidoModal {...base} inicial={{ alias: 'Juan', observaciones: 'Timbre 2' }} />);
    expect(alias()).toHaveValue('Juan');
    expect(obs()).toHaveValue('Timbre 2');
    expect(guardar()).toBeEnabled();
  });

  it('guardando deshabilita el botón', () => {
    render(<GuardarPedidoModal {...base} guardando inicial={{ alias: 'Juan', observaciones: '' }} />);
    expect(guardar()).toBeDisabled();
  });

  it('muestra el error en un alert', () => {
    render(<GuardarPedidoModal {...base} error="No se pudo guardar" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar');
  });

  it('Cancelar y Escape llaman a onCancelar', () => {
    const onCancelar = vi.fn();
    render(<GuardarPedidoModal {...base} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelar).toHaveBeenCalledTimes(2);
  });
});
