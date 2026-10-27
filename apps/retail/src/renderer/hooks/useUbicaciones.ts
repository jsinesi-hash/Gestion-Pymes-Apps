import { useState, useEffect } from 'react';

import { bridge } from '@core/ui';
export function useUbicaciones() {
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);
  useEffect(() => {
    bridge().catalogo.ubicacion.list().then(setUbicaciones);
  }, []);
  return ubicaciones;
}
