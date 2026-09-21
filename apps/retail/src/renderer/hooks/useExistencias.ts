import { useCallback, useEffect, useState } from 'react';

export type Existencias = {
  id: string;
  productoId: string;
  stockFisico: number;
  stockMinimo: number;
  stockMaximo: number | null;
  ultimaFechaMovimiento: string | null;
};

export function useExistencias(productoId: string) {
  const [existencias, setExistencias] = useState<Existencias | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await (globalThis as any).ferreteria.catalogo.existencias.get({ producto_id: productoId });
      if (!data) { setExistencias(null); return; }
      setExistencias({
        id: data.id,
        productoId: data.producto_id,
        stockFisico: data.stock_fisico ?? 0,
        stockMinimo: data.stock_minimo ?? 0,
        stockMaximo: data.stock_maximo ?? null,
        ultimaFechaMovimiento: data.ultima_fecha_movimiento ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { existencias, loading, refetch };
}
