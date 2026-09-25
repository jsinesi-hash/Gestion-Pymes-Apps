import { useState, useEffect, useCallback } from 'react';

export type CategoriaVentaRow = { id: string; nombre: string; orden: number; activo: boolean };

export function useCategoriasVenta() {
  const [categorias, setCategorias] = useState<CategoriaVentaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setCategorias(await (globalThis as any).elaborados.categoriaVenta.list());
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: { nombre: string; orden: number }) {
    await (globalThis as any).elaborados.categoriaVenta.create(payload);
    await load();
  }

  return { categorias, loading, crear };
}
