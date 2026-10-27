import { useState, useEffect, useCallback } from 'react';

import { bridge } from '@core/ui';
export function useMarcas() {
  const [marcas, setMarcas] = useState<any[]>([]);
  const load = useCallback(async () => {
    setMarcas(await bridge().catalogo.marca.list());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createMarca(nombre: string) {
    const m = await bridge().catalogo.marca.create({ nombre });
    await load();
    return m;
  }

  return { marcas, createMarca };
}
