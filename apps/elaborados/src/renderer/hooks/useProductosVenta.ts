import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';
export type ProductoVentaRow = {
  id: string; nombre: string; categoria_venta_id: string; precio_centavos: number; impuesto_id: string; activo: boolean;
};
export type ProductoVentaDetalle = ProductoVentaRow & {
  componentes: { articulo_id: string; cantidad: number }[];
  grupos: { grupo_modificador_id: string; min: number; max: number; cantidad_total: number; modo_descuento: string; orden: number }[];
};

export function useProductosVenta() {
  const [productos, setProductos] = useState<ProductoVentaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setProductos(await bridge().productoVenta.list());
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: {
    nombre: string; categoria_venta_id: string; precio_centavos: number; impuesto_id: string;
    componentes: { articulo_id: string; cantidad: number }[];
    grupos: { grupo_modificador_id: string; min: number; max: number; cantidad_total: number; modo_descuento: string; orden: number }[];
  }) {
    await bridge().productoVenta.create(payload);
    await load();
  }

  return { productos, loading, crear };
}
