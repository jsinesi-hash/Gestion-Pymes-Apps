import { useState, useEffect } from 'react';

import { bridge } from '@core/ui';
export function useCategorias() {
  const [categorias, setCategorias] = useState<any[]>([]);
  useEffect(() => {
    bridge().catalogo.categoria.list().then(setCategorias);
  }, []);
  return categorias;
}
