import { useState, useEffect, useCallback } from 'react';

export type ArticuloRow = {
  id: string;
  nombre: string;
  tipo: 'insumo' | 'elaborado' | 'reventa';
  unidad: 'kg' | 'l' | 'u';
  bloquea_sin_stock: boolean;
  stock_minimo: number | null;
  costo_promedio_centavos: number;
  activo: boolean;
  stock: number | null;
};

export function useArticulos() {
  const [articulos, setArticulos] = useState<ArticuloRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setArticulos(await (globalThis as any).elaborados.articulo.list());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: {
    nombre: string; tipo: ArticuloRow['tipo']; unidad: ArticuloRow['unidad'];
    bloquea_sin_stock: boolean; stock_minimo: number | null;
  }) {
    await (globalThis as any).elaborados.articulo.create(payload);
    await load();
  }

  async function actualizar(payload: { id: string } & Partial<{
    nombre: string; bloquea_sin_stock: boolean; stock_minimo: number | null; activo: boolean;
  }>) {
    await (globalThis as any).elaborados.articulo.update(payload);
    await load();
  }

  async function ajustarStock(payload: {
    articulo_id: string; motivo: 'conteo' | 'merma' | 'compra'; cantidad: number;
    costo_unitario_centavos?: number | null; observaciones?: string;
  }) {
    await (globalThis as any).elaborados.movimientoArticulo.create(payload);
    await load();
  }

  return { articulos, loading, crear, actualizar, ajustarStock, reload: load };
}
