import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';

export type CompraRow = {
  id: string; numero: string; proveedor_id: string | null; proveedor_nombre: string | null;
  comprobante: string | null; total_centavos: number; estado: 'confirmada' | 'anulada';
  fecha: number | string | Date; observaciones: string | null;
};

export type ProveedorRow = { id: string; razon_social: string };

export type CompraItemPayload = { articulo_id: string; cantidad: number; costo_unitario_centavos: number };

export type CompraCrearPayload = {
  proveedor_id?: string; comprobante?: string; observaciones?: string; items: CompraItemPayload[];
};

export type AnularCompraPayload = {
  id: string; motivo: string; supervisor_credenciales: { nombre_usuario: string; password: string };
};

// El bridge de la app se tipa como `any`: el namespace `compra`/`proveedor` es propio de Elaborados.
const api = () => bridge() as any;

export function useCompras() {
  const [compras, setCompras] = useState<CompraRow[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([api().compra.list(), api().compra.proveedores()]);
    setCompras(c);
    setProveedores(p);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(payload: CompraCrearPayload) {
    await api().compra.crear(payload);
    await load();
  }

  async function anular(payload: AnularCompraPayload) {
    await api().compra.anular(payload);
    await load();
  }

  async function crearProveedorRapido(razon_social: string): Promise<ProveedorRow> {
    const p = await api().compra.proveedorCrearRapido({ razon_social });
    await load();
    return p;
  }

  async function obtener(id: string) {
    return api().compra.get({ id });
  }

  return { compras, proveedores, loading, crear, anular, crearProveedorRapido, obtener, reload: load };
}
