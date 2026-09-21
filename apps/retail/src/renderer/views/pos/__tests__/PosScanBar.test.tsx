import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PosScanBar } from '../PosScanBar';

describe('PosScanBar — alta express (PROD-3)', () => {
  it('ofrece crear producto cuando la búsqueda no arroja resultados', async () => {
    vi.useFakeTimers();
    (globalThis as any).ferreteria = {
      presentacion: { buscarPorGtin: vi.fn().mockResolvedValue(null) },
      catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [] }) } },
    };
    render(<PosScanBar onAdd={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/escanear/i), { target: { value: 'pincel' } });
    await vi.runAllTimersAsync();
    expect(screen.getByRole('button', { name: /crear producto/i })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('no ofrece crear producto mientras hay resultados', async () => {
    vi.useFakeTimers();
    (globalThis as any).ferreteria = {
      presentacion: { buscarPorGtin: vi.fn().mockResolvedValue(null) },
      catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [{ id: 'p1', nombre_corto: 'Pincel', sku: 'P-1' }] }) } },
    };
    render(<PosScanBar onAdd={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/escanear/i), { target: { value: 'pincel' } });
    await vi.runAllTimersAsync();
    expect(screen.queryByRole('button', { name: /crear producto/i })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('crea el producto desde el modal y lo agrega a la venta', async () => {
    vi.useFakeTimers();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).ferreteria = {
      presentacion: { buscarPorGtin: vi.fn().mockResolvedValue(null) },
      catalogo: {
        producto: {
          list: vi.fn().mockResolvedValue({ items: [] }),
          quickCreate: vi.fn().mockResolvedValue({ id: 'np', sku: 'P-0000001-1', nombre_corto: 'Pincel' }),
        },
      },
    };
    render(<PosScanBar onAdd={onAdd} />);
    fireEvent.change(screen.getByPlaceholderText(/escanear/i), { target: { value: 'pincel' } });
    await vi.runAllTimersAsync();

    fireEvent.click(screen.getByRole('button', { name: /crear producto/i }));
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear producto$/i }));

    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith('np'));
    vi.useRealTimers();
  });
});
