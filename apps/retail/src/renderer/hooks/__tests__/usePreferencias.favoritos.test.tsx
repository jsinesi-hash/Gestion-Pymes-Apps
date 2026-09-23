import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferencias } from '../usePreferencias';

const actualizarPreferencias = vi.fn();
let mockSession: any = { id: 'u1', preferencias: { favoritos: ['/pos'], pantalla_inicio: null } };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: mockSession, actualizarPreferencias }),
}));

describe('usePreferencias — favoritos (ADR-080)', () => {
  afterEach(() => { delete (globalThis as any).ferreteria; actualizarPreferencias.mockClear(); });

  it('toggleFavorito agrega si no está y persiste + actualiza sesión', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).ferreteria = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias());
    await act(async () => { await result.current.toggleFavorito('/stock'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', favoritos: ['/pos', '/stock'] });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ favoritos: ['/pos', '/stock'] });
  });

  it('toggleFavorito quita si ya está', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).ferreteria = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias());
    await act(async () => { await result.current.toggleFavorito('/pos'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', favoritos: [] });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ favoritos: [] });
  });

  it('guardarInicio persiste y actualiza la sesión', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).ferreteria = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias());
    await act(async () => { await result.current.guardarInicio('/pos'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', pantalla_inicio: '/pos' });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ pantalla_inicio: '/pos' });
  });
});
