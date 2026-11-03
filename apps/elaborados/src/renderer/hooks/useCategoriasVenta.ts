import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';
export type CategoriaVentaRow = { id: string; nombre: string; orden: number; activo: boolean };

export function useCategoriasVenta() {
  const [categorias, setCategorias] = useState<CategoriaVentaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setCategorias(await bridge().categoriaVenta.list());
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: { nombre: string; orden: number }) {
    await bridge().categoriaVenta.create(payload);
    await load();
  }

  return { categorias, loading, crear };
}
