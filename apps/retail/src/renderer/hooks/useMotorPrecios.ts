import { useEffect, useState } from 'react';

import { bridge } from '@core/ui';
/**
 * Feature flag motor_precios_v2_habilitado (ADR-049). Default false: si el parámetro
 * no existe o la lectura falla, el Motor de Precios v2 queda apagado y las pantallas
 * se comportan como antes.
 */
export function useMotorPreciosV2Habilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    let vigente = true;
    const p = bridge()?.parametros?.get?.({ clave: 'motor_precios_v2_habilitado' });
    Promise.resolve(p)
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);

  return habilitado;
}
