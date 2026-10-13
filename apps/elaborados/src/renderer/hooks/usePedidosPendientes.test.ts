import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePedidosPendientes } from './usePedidosPendientes';

const fila = (id: string) => ({ id, alias: id, observaciones: null, en_espera_desde: new Date(), turno_creacion_id: null, cliente_id: 'c', total: 10, count_items: 1, vencida: false });

describe('usePedidosPendientes', () => {
  let listar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    listar = vi.fn();
    vi.stubGlobal('elaborados', { ventaEspera: { listar } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carga al montar', async () => {
    listar.mockResolvedValue([fila('a')]);
    const { result } = renderHook(() => usePedidosPendientes());
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.pedidos.map((p) => p.id)).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('recargar vuelve a pedir', async () => {
    listar.mockResolvedValueOnce([fila('a')]).mockResolvedValueOnce([fila('a'), fila('b')]);
    const { result } = renderHook(() => usePedidosPendientes());
    await waitFor(() => expect(result.current.pedidos).toHaveLength(1));
    act(() => result.current.recargar());
    await waitFor(() => expect(result.current.pedidos).toHaveLength(2));
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('un error queda traducido en error', async () => {
    listar.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const { result } = renderHook(() => usePedidosPendientes());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).not.toBe('UNAUTHENTICATED');
    expect(result.current.pedidos).toEqual([]);
  });
});
