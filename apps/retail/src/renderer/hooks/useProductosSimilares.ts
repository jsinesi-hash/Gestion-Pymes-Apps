import { useEffect, useState } from 'react';

import { bridge } from '@core/ui';
// Resultado del servicio de búsqueda por similitud (espejo de CandidatoSimilarEnriquecido del main).
export type ProductoSimilar = {
  producto_id: string;
  sku: string;
  nombre_corto: string;
  marca_nombre: string | null;
  precio_final_centavos: number;
  precio_origen: 'promocion' | 'vigente' | 'fallback';
  stock_fisico: number;
  score: number;
};

type Opts = { debounceMs?: number; limite?: number; piso?: number; clienteId?: string };

// Consume el servicio único `catalogo.producto.buscarSimilares` (matcher token-set de
// ADR-063). Debouncea el texto para no golpear el matcher en cada tecla. Texto vacío →
// sin resultados y sin llamada. Nunca selecciona automáticamente: sólo sugiere.
export function useProductosSimilares(texto: string, opts: Opts = {}) {
  const { debounceMs = 250, limite, piso, clienteId } = opts;
  const [items, setItems] = useState<ProductoSimilar[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = (texto ?? '').trim();
    if (!q) { setItems([]); setLoading(false); return; }

    let vigente = true;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.resolve(bridge()?.catalogo?.producto?.buscarSimilares?.({ texto: q, clienteId, limite, piso }))
        .then((res: ProductoSimilar[] | null) => { if (vigente) setItems(res ?? []); })
        .catch(() => { if (vigente) setItems([]); })
        .finally(() => { if (vigente) setLoading(false); });
    }, debounceMs);

    return () => { vigente = false; clearTimeout(timer); };
  }, [texto, debounceMs, limite, piso, clienteId]);

  return { items, loading };
}
