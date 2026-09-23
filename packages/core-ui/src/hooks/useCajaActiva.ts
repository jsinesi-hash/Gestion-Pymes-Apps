import { bridge } from '../bridge';
import { useState, useEffect, useCallback } from 'react';

export type CajaActiva = {
  id: string;
  usuario_id: string;
  fecha_apertura: Date;
  monto_inicial: number;
  estado: 'abierta' | 'cerrada';
  observaciones: string | null;
};

export function useCajaActiva() {
  const [caja, setCaja] = useState<CajaActiva | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await bridge().caja.getActiva();
      setCaja(result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { caja, isLoading, error, refetch };
}
