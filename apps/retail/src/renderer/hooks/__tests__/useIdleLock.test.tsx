import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleLock } from '@core/ui';

describe('useIdleLock', () => {
  it('bloquea tras el timeout de inactividad', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleLock(1));
    expect(result.current.locked).toBe(false);
    act(() => { vi.advanceTimersByTime(60_000 + 100); });
    expect(result.current.locked).toBe(true);
    vi.useRealTimers();
  });

  it('no arma nada con 0 minutos', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleLock(0));
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(result.current.locked).toBe(false);
    vi.useRealTimers();
  });

  it('la actividad resetea el timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleLock(1));
    act(() => { vi.advanceTimersByTime(50_000); window.dispatchEvent(new Event('keydown')); });
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.locked).toBe(false);
    act(() => { vi.advanceTimersByTime(40_000); });
    expect(result.current.locked).toBe(true);
    vi.useRealTimers();
  });
});
