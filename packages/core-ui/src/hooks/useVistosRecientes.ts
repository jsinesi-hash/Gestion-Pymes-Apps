import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../bridge';

// Vistos recientemente (ADR-081 / PERF-2). Estado operativo LOCAL por terminal, en
// localStorage por usuario: NO sincroniza, NO va a la BD ni al backup — mismo tratamiento que
// los recientes de la paleta de comandos (`cmdk_recientes`) y coherente con la doctrina de
// estado local de ADR-047 §10. Todo acceso va envuelto en try/catch para tolerar localStorage
// ausente, lleno o corrupto.

export const MAX_VISTOS = 8;

export type VistoReciente = {
  tipo: string;
  id: string;
  etiqueta: string;
  ts: number;
};

const EVENTO = 'vistos-recientes-cambio';

function clave(userId: string): string {
  return `vistos_recientes_u${userId}`;
}

export function leerVistos(userId: string): VistoReciente[] {
  try {
    const raw = localStorage.getItem(clave(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (v): v is VistoReciente =>
        v && typeof v.tipo === 'string' && typeof v.id === 'string',
    );
  } catch {
    return [];
  }
}

export function registrarVisto(userId: string, entrada: Omit<VistoReciente, 'ts'>): void {
  try {
    const previos = leerVistos(userId).filter(
      (v) => !(v.tipo === entrada.tipo && v.id === entrada.id),
    );
    const lista = [{ ...entrada, ts: Date.now() }, ...previos].slice(0, MAX_VISTOS);
    localStorage.setItem(clave(userId), JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: { userId } }));
  } catch {
    /* localStorage no disponible/lleno: la feature es best-effort. */
  }
}

/** Lista reactiva de vistos recientes del usuario, refrescada al registrar uno nuevo. */
export function useVistosRecientes(userId: string | null | undefined): VistoReciente[] {
  const [vistos, setVistos] = useState<VistoReciente[]>(() => (userId ? leerVistos(userId) : []));

  useEffect(() => {
    if (!userId) {
      setVistos([]);
      return;
    }
    const refrescar = () => setVistos(leerVistos(userId));
    refrescar();
    window.addEventListener(EVENTO, refrescar);
    return () => window.removeEventListener(EVENTO, refrescar);
  }, [userId]);

  return vistos;
}

/**
 * Devuelve una función para registrar el ítem visto. No-op si el flag está apagado o no hay
 * sesión, así los componentes de detalle la llaman sin condicionar el montaje del efecto.
 */
export function useRegistrarVisto(): (entrada: Omit<VistoReciente, 'ts'>) => void {
  const { session } = useAuth();
  const habilitado = useVistosRecientesHabilitado();
  const userId = session?.id ?? null;
  return useCallback(
    (entrada: Omit<VistoReciente, 'ts'>) => {
      if (!habilitado || !userId) return;
      registrarVisto(userId, entrada);
    },
    [habilitado, userId],
  );
}

/** Feature flag `vistos_recientes_habilitado`. Default false ante ausencia/fallo. */
export function useVistosRecientesHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    Promise.resolve(bridge()?.parametros?.get?.({ clave: 'vistos_recientes_habilitado' }))
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);
  return habilitado;
}
