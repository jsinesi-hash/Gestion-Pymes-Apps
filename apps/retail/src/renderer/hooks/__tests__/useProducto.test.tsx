import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProducto } from '../useProducto';

const mockGet = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = { catalogo: { producto: { get: mockGet } } };
});

describe('useProducto', () => {
  it('retorna null y loading=true antes de resolver', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProducto('1'));
    expect(result.current.producto).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('carga producto por id', async () => {
    mockGet.mockResolvedValue({ id: '1', nombre_corto: 'Taladro' });
    const { result } = renderHook(() => useProducto('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.producto?.nombre_corto).toBe('Taladro');
    expect(result.current.error).toBeNull();
  });

  it('error si falla la carga', async () => {
    mockGet.mockRejectedValue(new Error('NOT_FOUND'));
    const { result } = renderHook(() => useProducto('1'));
    await waitFor(() => expect(result.current.error).toBe('NOT_FOUND'));
    expect(result.current.loading).toBe(false);
  });

  it('no llama a get si id es undefined', () => {
    const { result } = renderHook(() => useProducto(undefined));
    expect(result.current.loading).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
