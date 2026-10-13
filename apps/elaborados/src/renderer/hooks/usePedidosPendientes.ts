import { useCallback, useEffect, useState } from 'react';
import { bridge, traducirError } from '@core/ui';

/** Resumen devuelto por `ventaEspera.listar`. `total` viene en PESOS (columna legado del encabezado). */
export type PedidoPendiente = {
  id: string;
  alias: string | null;
  observaciones: string | null;
  en_espera_desde: Date | string | number | null;
  turno_creacion_id: string | null;
  cliente_id: string;
  total: number;
  count_items: number;
  vencida: boolean;
};

export function usePedidosPendientes() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const r = (await (bridge() as any).ventaEspera.listar()) as PedidoPendiente[];
        if (vigente) setPedidos(r);
      } catch (e) {
        if (vigente) setError(traducirError(e).mensaje);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => { vigente = false; };
  }, [version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { pedidos, cargando, error, recargar };
}
