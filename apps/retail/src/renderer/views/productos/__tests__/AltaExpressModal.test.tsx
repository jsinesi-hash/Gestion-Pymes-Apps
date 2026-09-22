import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AltaExpressModal } from '../AltaExpressModal';
import { ToastProvider } from '@core/ui';

function wrap(ui: React.ReactNode) { return <ToastProvider>{ui}</ToastProvider>; }

beforeEach(() => {
  (globalThis as any).ferreteria = {
    catalogo: { producto: { quickCreate: vi.fn().mockResolvedValue({ id: 'p1', sku: 'P-0000001-1', nombre_corto: 'Taladro' }) } },
  };
});

describe('AltaExpressModal', () => {
  it('no crea si el precio es 0 y muestra error inline', async () => {
    const onCreado = vi.fn();
    render(wrap(<AltaExpressModal nombreInicial="Taladro" onCreado={onCreado} onClose={() => {}} />));
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /crear producto/i }));
    expect(await screen.findByText(/mayor a 0/i)).toBeInTheDocument();
    expect(onCreado).not.toHaveBeenCalled();
  });

  it('crea y devuelve el producto', async () => {
    const onCreado = vi.fn();
    render(wrap(<AltaExpressModal nombreInicial="Taladro" onCreado={onCreado} onClose={() => {}} />));
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /crear producto/i }));
    await waitFor(() => expect(onCreado).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })));
    expect((globalThis as any).ferreteria.catalogo.producto.quickCreate)
      .toHaveBeenCalledWith(expect.objectContaining({ nombre_corto: 'Taladro', precio_venta_lista: 1500 }));
  });
});
