import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';
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
    setArticulos(await bridge().articulo.list());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: {
    nombre: string; tipo: ArticuloRow['tipo']; unidad: ArticuloRow['unidad'];
    bloquea_sin_stock: boolean; stock_minimo: number | null;
  }) {
    await bridge().articulo.create(payload);
    await load();
  }

  async function actualizar(payload: { id: string } & Partial<{
    nombre: string; bloquea_sin_stock: boolean; stock_minimo: number | null; activo: boolean;
  }>) {
    await bridge().articulo.update(payload);
    await load();
  }

  async function ajustarStock(payload: {
    articulo_id: string; motivo: 'conteo' | 'merma' | 'compra'; cantidad: number;
    costo_unitario_centavos?: number | null; observaciones?: string;
  }) {
    await bridge().movimientoArticulo.create(payload);
    await load();
  }

  async function obtenerReceta(articulo_id: string) {
    return bridge().recetaProduccion.get({ articulo_id });
  }

  async function guardarReceta(payload: { articulo_id: string; rinde_cantidad: number; items: { articulo_id: string; cantidad: number }[] }) {
    await bridge().recetaProduccion.set(payload);
  }

  return { articulos, loading, crear, actualizar, ajustarStock, obtenerReceta, guardarReceta, reload: load };
}
