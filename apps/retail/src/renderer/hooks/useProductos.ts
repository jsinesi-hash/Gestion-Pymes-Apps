import { useState, useEffect, useCallback } from 'react';
import { useCatalogoContext } from '../context/CatalogoContext';

import { bridge } from '@core/ui';
export function useProductos(pageSize = 20) {
  const { busqueda, busquedaUbicacion, filtros, sortBy, sortDir, pagina } = useCatalogoContext();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bridge().catalogo.producto.list({
        busqueda: busqueda || undefined,
        busqueda_ubicacion: busquedaUbicacion || undefined,
        ...filtros,
        sortBy,
        sortDir,
        page: pagina,
        pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [busqueda, busquedaUbicacion, filtros, sortBy, sortDir, pagina, pageSize]);

  useEffect(() => { fetch(); }, [fetch]);

  return { items, total, loading, refetch: fetch };
}
