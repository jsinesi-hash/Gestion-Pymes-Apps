import { useState, useEffect, useCallback } from 'react';

import { bridge } from '@core/ui';
export function useListasPrecios() {
  const [listas, setListas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bridge().precios.lista.list();
      setListas(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { listas, loading, refetch: fetch };
}
