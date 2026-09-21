import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProductosSimilares } from '../useProductosSimilares';

const mockBuscar = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = { catalogo: { producto: { buscarSimilares: mockBuscar } } };
  mockBuscar.mockResolvedValue([]);
});

describe('useProductosSimilares', () => {
  it('no llama al servicio con texto vacío', async () => {
    renderHook(() => useProductosSimilares('   ', { debounceMs: 0 }));
    // pequeña espera para descartar una llamada diferida
    await new Promise(r => setTimeout(r, 10));
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it('llama a buscarSimilares con el texto y devuelve los items', async () => {
    mockBuscar.mockResolvedValue([{ producto_id: 'p1', sku: 'P-1', nombre_corto: 'Tarugo 8mm', score: 0.8 }]);
    const { result } = renderHook(() => useProductosSimilares('tarugo 8 mm', { debounceMs: 0 }));
    await waitFor(() => expect(mockBuscar).toHaveBeenCalled());
    expect(mockBuscar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'tarugo 8 mm' }));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].producto_id).toBe('p1');
  });

  it('reejecuta al cambiar el texto', async () => {
    const { rerender } = renderHook(({ q }) => useProductosSimilares(q, { debounceMs: 0 }), {
      initialProps: { q: 'tarugo' },
    });
    await waitFor(() => expect(mockBuscar).toHaveBeenCalledTimes(1));
    act(() => { rerender({ q: 'tornillo' }); });
    await waitFor(() => expect(mockBuscar).toHaveBeenCalledTimes(2));
    expect(mockBuscar).toHaveBeenLastCalledWith(expect.objectContaining({ texto: 'tornillo' }));
  });

  it('pasa clienteId al servicio y expone los campos enriquecidos', async () => {
    const buscarSimilares = vi.fn().mockResolvedValue([
      { producto_id: 'p1', sku: 'P-1', nombre_corto: 'Pincel 3x8', marca_nombre: 'Marca A',
        precio_final_centavos: 12345, precio_origen: 'vigente', stock_fisico: 5, score: 0.9 },
    ]);
    (globalThis as any).ferreteria = { catalogo: { producto: { buscarSimilares } } };

    const { result } = renderHook(() => useProductosSimilares('pincel 3x8', { debounceMs: 0, clienteId: 'c1' }));

    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(buscarSimilares).toHaveBeenCalledWith(expect.objectContaining({ texto: 'pincel 3x8', clienteId: 'c1' }));
    expect(result.current.items[0].precio_final_centavos).toBe(12345);
    expect(result.current.items[0].stock_fisico).toBe(5);
  });
});
