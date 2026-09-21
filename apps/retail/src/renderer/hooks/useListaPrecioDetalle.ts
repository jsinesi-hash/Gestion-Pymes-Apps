import { useState, useEffect, useCallback } from 'react';

export function useListaPrecioDetalle(productoId: string) {
  const [detalles, setDetalles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (globalThis as any).ferreteria.precios.detalle.listByProducto({ productoId });
      setDetalles(result);
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { detalles, loading, refetch: fetch };
}
