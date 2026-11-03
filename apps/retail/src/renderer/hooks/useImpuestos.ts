import { useState, useEffect } from 'react';

import { bridge } from '@core/ui';
export function useImpuestos() {
  const [impuestos, setImpuestos] = useState<any[]>([]);
  useEffect(() => {
    bridge().catalogo.impuesto.list().then(setImpuestos);
  }, []);
  return impuestos;
}
