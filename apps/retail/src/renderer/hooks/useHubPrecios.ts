import { useEffect, useState } from 'react';

/**
 * Feature flag hub_precios_habilitado (ADR-078). Default false: si el parámetro no existe
 * o la lectura falla, el hub de Precios/Costos queda apagado y el sidebar/rutas se
 * comportan como antes.
 */
export function useHubPreciosHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    const p = (globalThis as any).ferreteria?.parametros?.get?.({ clave: 'hub_precios_habilitado' });
    Promise.resolve(p)
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);
  return habilitado;
}
