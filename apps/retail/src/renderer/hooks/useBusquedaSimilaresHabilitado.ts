import { useEffect, useState } from 'react';

import { bridge } from '@core/ui';
/**
 * Feature flag `busqueda_similares_habilitado`. Default false: si el parámetro no existe o
 * la lectura falla, el modo "Buscar similares" del Catálogo queda apagado y la pantalla se
 * comporta como antes (búsqueda por substring + sinónimos).
 */
export function useBusquedaSimilaresHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    let vigente = true;
    const p = bridge()?.parametros?.get?.({ clave: 'busqueda_similares_habilitado' });
    Promise.resolve(p)
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);

  return habilitado;
}
