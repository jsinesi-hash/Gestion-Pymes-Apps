import { useEffect, useState } from 'react';

/**
 * Feature flag inicio_personalizable_habilitado (ADR-080). Default false: si el parámetro
 * no existe o la lectura falla, el inicio personalizable y los favoritos quedan apagados y
 * el redirect raíz / sidebar se comportan como antes.
 */
export function useInicioPersonalizableHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    const p = (globalThis as any).ferreteria?.parametros?.get?.({ clave: 'inicio_personalizable_habilitado' });
    Promise.resolve(p)
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);
  return habilitado;
}
