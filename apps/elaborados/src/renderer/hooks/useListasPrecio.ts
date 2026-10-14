import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';

export type ListaPrecioRow = {
  id: string; nombre: string; descripcion: string | null; ajuste_porcentual: number; activo: boolean;
};

export type ListaCrearPayload = { nombre: string; ajuste_porcentual: number };
export type ListaActualizarPayload = { id: string; nombre?: string; ajuste_porcentual?: number; activo?: boolean };
export type PrecioListaRow = { producto_venta_id: string; precio_centavos: number };

// El namespace `listaPrecio` es propio de Elaborados: el bridge se tipa como `any`.
const api = () => bridge() as any;

export function useListasPrecio() {
  const [listas, setListas] = useState<ListaPrecioRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setListas(await api().listaPrecio.list());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: ListaCrearPayload) {
    await api().listaPrecio.create(payload);
    await load();
  }

  async function actualizar(payload: ListaActualizarPayload) {
    await api().listaPrecio.update(payload);
    await load();
  }

  // Estables: el modal de precios los usa como dependencia de un efecto.
  const preciosDe = useCallback(
    (lista_precio_id: string): Promise<PrecioListaRow[]> => api().listaPrecio.precios({ lista_precio_id }), []);

  const fijarPrecio = useCallback(
    (payload: { lista_precio_id: string; producto_venta_id: string; precio_centavos: number | null }) =>
      api().listaPrecio.precioSet(payload), []);

  return { listas, loading, crear, actualizar, preciosDe, fijarPrecio };
}
