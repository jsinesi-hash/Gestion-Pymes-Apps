import { useState, useEffect, useCallback } from 'react';

export type ProduccionRow = {
  id: string; numero: string; articulo_id: string; cantidad_producida: number;
  costo_total_centavos: number; estado: 'confirmada' | 'anulada'; fecha: number; observaciones: string | null;
};

export function useProduccion() {
  const [producciones, setProducciones] = useState<ProduccionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setProducciones(await (globalThis as any).elaborados.produccion.list());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: { articulo_id: string; cantidad_producida: number; observaciones?: string }) {
    await (globalThis as any).elaborados.produccion.crear(payload);
    await load();
  }

  async function anular(payload: { id: string; motivo: string; supervisor_credenciales: { nombre_usuario: string; password: string } }) {
    await (globalThis as any).elaborados.produccion.anular(payload);
    await load();
  }

  async function obtenerReceta(articulo_id: string) {
    return (globalThis as any).elaborados.recetaProduccion.get({ articulo_id });
  }

  return { producciones, loading, crear, anular, obtenerReceta, reload: load };
}
