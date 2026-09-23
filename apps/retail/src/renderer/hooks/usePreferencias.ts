import { useState, useEffect } from 'react';
import { MAX_FAVORITOS } from '@ferreteria/shared';
import { useAuth } from '../context/AuthContext';

export function usePreferencias() {
  const { session, actualizarPreferencias } = useAuth();
  const [preferencias, setPreferencias] = useState<any>(null);

  useEffect(() => {
    if (!session?.id) return;
    // Optional chaining: en tests/consumidores sin el bridge de preferencias no debe romper.
    (globalThis as any).ferreteria?.preferencias?.get?.({ usuario_id: session.id })
      ?.then?.(setPreferencias);
  }, [session?.id]);

  async function guardar(prefs: { tema: string; acento: string; ui_font: string; skin: string }) {
    await (globalThis as any).ferreteria.preferencias.save({ usuario_id: session!.id, ...prefs });
    setPreferencias((prev: any) => ({ ...(prev ?? {}), ...prefs }));
  }

  async function guardarInicio(pantalla_inicio: string | null) {
    await (globalThis as any).ferreteria.preferencias.save({ usuario_id: session!.id, pantalla_inicio });
    actualizarPreferencias({ pantalla_inicio });
  }

  async function toggleFavorito(path: string) {
    const actuales: string[] = session?.preferencias?.favoritos ?? [];
    const existe = actuales.includes(path);
    const favoritos = existe ? actuales.filter((p) => p !== path) : [...actuales, path];
    if (!existe && favoritos.length > MAX_FAVORITOS) return; // tope; la UI ya lo evita
    await (globalThis as any).ferreteria.preferencias.save({ usuario_id: session!.id, favoritos });
    actualizarPreferencias({ favoritos });
  }

  return { preferencias, guardar, guardarInicio, toggleFavorito };
}
