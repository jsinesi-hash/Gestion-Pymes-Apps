import { useCallback, useEffect, useState } from 'react';

export type EquivalenciaItem = {
  id: string; producto_id: string; sku: string; nombre_corto: string;
  marca_nombre: string | null; precio_final_centavos: number;
  precio_origen: 'promocion' | 'vigente' | 'fallback'; stock_fisico: number;
  discontinuado: boolean; nota: string | null;
};
export type EquivalenciaListResult = {
  equivalentes: EquivalenciaItem[]; reemplazado_por: EquivalenciaItem[]; reemplaza_a: EquivalenciaItem[];
};
const VACIO: EquivalenciaListResult = { equivalentes: [], reemplazado_por: [], reemplaza_a: [] };

export function useEquivalencias(productoId: string | undefined, habilitado: boolean) {
  const [data, setData] = useState<EquivalenciaListResult>(VACIO);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!productoId || !habilitado) { setData(VACIO); return; }
    setLoading(true);
    try {
      const r = await (globalThis as any).ferreteria?.catalogo?.producto?.equivalencia?.list?.({ producto_id: productoId });
      setData(r ?? VACIO);
    } catch { setData(VACIO); } finally { setLoading(false); }
  }, [productoId, habilitado]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}
