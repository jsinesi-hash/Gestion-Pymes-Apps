import { useEffect, useState } from 'react';

import { bridge } from '@core/ui';
// Feature flag `sustitutos_habilitado`. Default false ante ausencia/fallo.
export function useSustitutosHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    Promise.resolve(bridge()?.parametros?.get?.({ clave: 'sustitutos_habilitado' }))
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);
  return habilitado;
}
