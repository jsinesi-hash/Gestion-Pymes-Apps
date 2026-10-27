import { useState, useEffect } from 'react';

import { bridge } from '@core/ui';
export function useUnidades() {
  const [unidades, setUnidades] = useState<{ id: string; nombre: string; abreviatura: string }[]>([]);
  useEffect(() => {
    bridge().unidad.list().then(setUnidades).catch(() => {});
  }, []);
  return unidades;
}
