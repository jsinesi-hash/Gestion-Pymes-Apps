import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { CatalogoProvider } from '../../context/CatalogoContext';
import { useProductos } from '../useProductos';

const mockList = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = { catalogo: { producto: { list: mockList } } };
  mockList.mockResolvedValue({ items: [], total: 0 });
});

describe('useProductos', () => {
  it('llama a producto.list con page=1 y pageSize=20', async () => {
    renderHook(() => useProductos(), { wrapper: CatalogoProvider });
    await waitFor(() => expect(mockList).toHaveBeenCalledOnce());
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });

  it('retorna items y total del resultado', async () => {
    mockList.mockResolvedValue({ items: [{ id: '1', nombre_corto: 'Taladro' }], total: 1 });
    const { result } = renderHook(() => useProductos(), { wrapper: CatalogoProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(1);
    expect(result.current.items[0].nombre_corto).toBe('Taladro');
  });

  it('loading es true durante la carga', async () => {
    let resolve: (v: any) => void;
    mockList.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useProductos(), { wrapper: CatalogoProvider });
    expect(result.current.loading).toBe(true);
    resolve!({ items: [], total: 0 });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
