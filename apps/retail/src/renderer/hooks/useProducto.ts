import { useState, useEffect } from 'react';

export function useProducto(id: string | undefined) {
  const [producto, setProducto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (globalThis as any).ferreteria.catalogo.producto.get({ id })
      .then((p: any) => setProducto(p))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { producto, loading, error };
}
