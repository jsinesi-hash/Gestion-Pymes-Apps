import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePosCotizacion } from './usePosCotizacion';
import type { CarritoPayload, Cotizacion } from '../views/pos/tipos';

const vacio: CarritoPayload = { lineas: [], descuento_global_pct: 0 };
const conLineas = (cantidad: number): CarritoPayload => ({
  lineas: [{ producto_venta_id: 'p1', cantidad, descuento_linea_pct: 0, modificadores: [] }],
  descuento_global_pct: 0,
});
const cot = (total: number): Cotizacion => ({
  lineas: [], subtotal_centavos: total, descuento_global_centavos: 0, total_centavos: total,
  ajuste_redondeo_centavos: 0, importe_iva_centavos: 0, bloqueos: [], advertencias: [],
});

describe('usePosCotizacion', () => {
  let cotizar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    cotizar = vi.fn();
    vi.stubGlobal('elaborados', { venta: { cotizar } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('carrito vacío: cotizacion null y no llama a cotizar', async () => {
    const { result } = renderHook(() => usePosCotizacion(vacio));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.cotizacion).toBeNull();
    expect(cotizar).not.toHaveBeenCalled();
  });

  it('con líneas llama una vez tras el debounce y expone la cotización', async () => {
    cotizar.mockResolvedValue(cot(1000));
    const p = conLineas(1);
    const { result } = renderHook(() => usePosCotizacion(p));
    expect(cotizar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(cotizar).toHaveBeenCalledTimes(1);
    expect(cotizar).toHaveBeenCalledWith(p);
    expect(result.current.cotizacion?.total_centavos).toBe(1000);
    expect(result.current.cotizando).toBe(false);
  });

  it('dos cambios rápidos hacen una sola llamada con el último payload', async () => {
    cotizar.mockResolvedValue(cot(2000));
    const { rerender } = renderHook(({ p }) => usePosCotizacion(p), { initialProps: { p: conLineas(1) } });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    const ultimo = conLineas(2);
    rerender({ p: ultimo });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(cotizar).toHaveBeenCalledTimes(1);
    expect(cotizar).toHaveBeenCalledWith(ultimo);
  });

  it('descarta la respuesta obsoleta: la 1ª resuelve después de la 2ª', async () => {
    let resolver1!: (c: Cotizacion) => void;
    let resolver2!: (c: Cotizacion) => void;
    cotizar
      .mockReturnValueOnce(new Promise<Cotizacion>((r) => { resolver1 = r; }))
      .mockReturnValueOnce(new Promise<Cotizacion>((r) => { resolver2 = r; }));
    const { result, rerender } = renderHook(({ p }) => usePosCotizacion(p), { initialProps: { p: conLineas(1) } });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    rerender({ p: conLineas(2) });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(cotizar).toHaveBeenCalledTimes(2);
    await act(async () => { resolver2(cot(2222)); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.cotizacion?.total_centavos).toBe(2222);
    await act(async () => { resolver1(cot(1111)); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.cotizacion?.total_centavos).toBe(2222);
  });

  it('error traducido y sin cotización', async () => {
    cotizar.mockRejectedValue(new Error('CANTIDAD_INVALIDA'));
    const p = conLineas(1);
    const { result } = renderHook(() => usePosCotizacion(p));
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(result.current.error).toBe('Ingresá una cantidad válida.');
    expect(result.current.cotizacion).toBeNull();
  });
});
