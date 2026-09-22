import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider, useCallIpc } from '@core/ui';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('useCallIpc (ERR-1 / ADR-077)', () => {
  it('en éxito devuelve { ok: true, data } y muestra el toast de éxito si se pide', async () => {
    const { result } = renderHook(() => useCallIpc(), { wrapper });
    let r: Awaited<ReturnType<typeof result.current>>;
    await act(async () => {
      r = await result.current(() => Promise.resolve(42), { success: 'Guardado' });
    });
    expect(r!).toEqual({ ok: true, data: 42 });
    expect(screen.getByText('Guardado')).toBeInTheDocument();
  });

  it('sin opts.success no muestra toast en el éxito', async () => {
    const { result } = renderHook(() => useCallIpc(), { wrapper });
    await act(async () => { await result.current(() => Promise.resolve('x')); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('en error devuelve { ok: false, error } y muestra el error TRADUCIDO', async () => {
    const { result } = renderHook(() => useCallIpc(), { wrapper });
    const boom = new Error('UNIQUE constraint failed: producto.gtin_barcode');
    let r: Awaited<ReturnType<typeof result.current>>;
    await act(async () => { r = await result.current(() => Promise.reject(boom)); });
    expect(r!.ok).toBe(false);
    if (!r!.ok) expect(r!.error).toBe(boom);
    expect(screen.getByRole('alert')).toHaveTextContent(/código de barras/i);
  });

  it('en error expone el traducido con campo para el form', async () => {
    const { result } = renderHook(() => useCallIpc(), { wrapper });
    let r: any;
    await act(async () => {
      r = await result.current(async () => { throw new Error('VALIDATION:nombre:REQUERIDO'); });
    });
    expect(r.ok).toBe(false);
    expect(r.traducido.campo).toBe('nombre');
    expect(r.traducido.mensaje).toMatch(/obligatorio|requerido/i);
  });
});
