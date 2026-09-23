import { useEffect, useState } from 'react';
import { bridge } from '../bridge';

// SEC-3 (ADR-079): minutos efectivos de auto-bloqueo. 0 = desactivado (sin cambio de
// comportamiento). Requiere el flag `bloqueo_inactividad_habilitado` === 'true'; si está
// apagado (default) devuelve 0. El umbral vive en `bloqueo_inactividad_minutos` (default
// 15). Ambos sembrados por la migración 0045.
export function useBloqueoInactividad(): number {
  const [minutos, setMinutos] = useState(0);
  useEffect(() => {
    let vigente = true;
    const p = bridge().parametros;
    Promise.all([
      Promise.resolve(p?.get?.({ clave: 'bloqueo_inactividad_habilitado' })).catch(() => null),
      Promise.resolve(p?.get?.({ clave: 'bloqueo_inactividad_minutos' })).catch(() => null),
    ]).then(([hab, min]: [string | null, string | null]) => {
      if (!vigente) return;
      if (hab !== 'true') { setMinutos(0); return; }
      const n = Number.parseInt(min ?? '', 10);
      setMinutos(Number.isFinite(n) && n > 0 ? n : 15);
    }).catch(() => { if (vigente) setMinutos(0); });
    return () => { vigente = false; };
  }, []);
  return minutos;
}
