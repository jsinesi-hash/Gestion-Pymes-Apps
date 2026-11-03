import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferencias } from './usePreferencias';
import { AuthContext } from '../auth/AuthContext';
import { configurarBridge } from '../bridge';

// El núcleo no conoce la clave de ninguna app: se usa una neutra.
configurarBridge('appDePrueba');

const actualizarPreferencias = vi.fn();
let mockSession: any = { id: 'u1', preferencias: { favoritos: ['/pos'], pantalla_inicio: null } };
// usePreferencias vive en @core/ui y lee useAuth por ruta relativa interna, así que un
// override del barrel no lo alcanza: se provee el AuthContext real vía su Provider.
const wrapper = ({ children }: any) => (
  <AuthContext.Provider value={{ session: mockSession, actualizarPreferencias } as any}>{children}</AuthContext.Provider>
);

describe('usePreferencias — favoritos (ADR-080)', () => {
  afterEach(() => { delete (globalThis as any).appDePrueba; actualizarPreferencias.mockClear(); });

  it('toggleFavorito agrega si no está y persiste + actualiza sesión', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).appDePrueba = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias(), { wrapper });
    await act(async () => { await result.current.toggleFavorito('/stock'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', favoritos: ['/pos', '/stock'] });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ favoritos: ['/pos', '/stock'] });
  });

  it('toggleFavorito quita si ya está', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).appDePrueba = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias(), { wrapper });
    await act(async () => { await result.current.toggleFavorito('/pos'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', favoritos: [] });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ favoritos: [] });
  });

  it('guardarInicio persiste y actualiza la sesión', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).appDePrueba = { preferencias: { get: vi.fn().mockResolvedValue(null), save } };
    const { result } = renderHook(() => usePreferencias(), { wrapper });
    await act(async () => { await result.current.guardarInicio('/pos'); });
    expect(save).toHaveBeenCalledWith({ usuario_id: 'u1', pantalla_inicio: '/pos' });
    expect(actualizarPreferencias).toHaveBeenCalledWith({ pantalla_inicio: '/pos' });
  });
});
