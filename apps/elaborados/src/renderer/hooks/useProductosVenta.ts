import { useState, useEffect, useCallback } from 'react';

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
    setProductos(await (globalThis as any).elaborados.productoVenta.list());
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: {
    nombre: string; categoria_venta_id: string; precio_centavos: number; impuesto_id: string;
    componentes: { articulo_id: string; cantidad: number }[];
    grupos: { grupo_modificador_id: string; min: number; max: number; cantidad_total: number; modo_descuento: string; orden: number }[];
  }) {
    await (globalThis as any).elaborados.productoVenta.create(payload);
    await load();
  }

  return { productos, loading, crear };
}
