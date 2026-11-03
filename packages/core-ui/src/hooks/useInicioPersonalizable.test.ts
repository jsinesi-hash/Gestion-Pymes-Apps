import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInicioPersonalizableHabilitado } from './useInicioPersonalizable';
import { configurarBridge } from '../bridge';

// El núcleo no conoce la clave de ninguna app: se usa una neutra.
configurarBridge('appDePrueba');

describe('useInicioPersonalizableHabilitado', () => {
  afterEach(() => { delete (globalThis as any).appDePrueba; });

  it('devuelve true cuando el parámetro es "true"', async () => {
    (globalThis as any).appDePrueba = { parametros: { get: vi.fn().mockResolvedValue('true') } };
    const { result } = renderHook(() => useInicioPersonalizableHabilitado());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('devuelve false por default (sin bridge)', async () => {
    const { result } = renderHook(() => useInicioPersonalizableHabilitado());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
