import { useState, useEffect } from 'react';

import { bridge } from '@core/ui';
export function useUbicacion(id: string | undefined) {
  const [ubicacion, setUbicacion] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    bridge().catalogo.ubicacion.get({ id }).then(setUbicacion);
  }, [id]);
  return ubicacion;
}
