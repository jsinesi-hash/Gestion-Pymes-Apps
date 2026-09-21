import { useState, useEffect, useCallback } from 'react';

const f = () => (globalThis as any).ferreteria;

export function useListaPrecioValor(productoId: string) {
  const [vigentes, setVigentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await f().precios.valor.listarVigentesParaProducto(productoId);
      setVigentes(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { vigentes, loading, refetch };
}
