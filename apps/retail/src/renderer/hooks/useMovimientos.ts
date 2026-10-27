import { useCallback, useEffect, useState } from 'react';

import { bridge } from '@core/ui';
export type MovimientoStock = {
  id: string;
  productoId: string;
  tipo: string;
  motivo: string;
  cantidad: number;
  stockResultante: number;
  costoUnitario: number | null;
  referenciaTipo: string | null;
  referenciaId: string | null;
  usuarioId: string;
  fecha: string;
  observaciones: string | null;
};

export function useMovimientos(productoId: string) {
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data: any[] = await bridge().catalogo.movimientoStock.list({ producto_id: productoId }) ?? [];
      setMovimientos(data.map(m => ({
        id: m.id,
        productoId: m.producto_id,
        tipo: m.tipo,
        motivo: m.motivo,
        cantidad: m.cantidad,
        stockResultante: m.stock_resultante,
        costoUnitario: m.costo_unitario ?? null,
        referenciaTipo: m.referencia_tipo ?? null,
        referenciaId: m.referencia_id ?? null,
        usuarioId: m.usuario_id,
        fecha: m.fecha,
        observaciones: m.observaciones ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, [productoId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { movimientos, loading, refetch };
}
