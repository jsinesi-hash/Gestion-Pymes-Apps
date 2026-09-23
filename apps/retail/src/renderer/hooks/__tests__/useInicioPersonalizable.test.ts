import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInicioPersonalizableHabilitado } from '@core/ui';

describe('useInicioPersonalizableHabilitado', () => {
  afterEach(() => { delete (globalThis as any).ferreteria; });

  it('devuelve true cuando el parámetro es "true"', async () => {
    (globalThis as any).ferreteria = { parametros: { get: vi.fn().mockResolvedValue('true') } };
    const { result } = renderHook(() => useInicioPersonalizableHabilitado());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('devuelve false por default (sin bridge)', async () => {
    const { result } = renderHook(() => useInicioPersonalizableHabilitado());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
