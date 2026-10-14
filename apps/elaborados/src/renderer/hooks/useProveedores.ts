import { useState, useEffect, useCallback } from 'react';
import { bridge } from '@core/ui';

export const TIPOS_DOC = ['DNI', 'CUIT', 'CUIL'] as const;
export const CONDICIONES_FISCALES = ['Responsable Inscripto', 'Monotributo', 'Consumidor Final', 'Exento'] as const;

export type ProveedorRow = {
  id: string; codigo: string | null; razon_social: string;
  tipo_documento: (typeof TIPOS_DOC)[number]; numero_documento: string;
  condicion_fiscal: (typeof CONDICIONES_FISCALES)[number];
  telefono: string | null; email: string | null; persona_contacto: string | null;
  domicilio: string | null; observaciones: string | null; activo: boolean;
};

export type ProveedorPayload = {
  id?: string; razon_social: string; tipo_documento: ProveedorRow['tipo_documento'];
  numero_documento: string; condicion_fiscal: ProveedorRow['condicion_fiscal'];
  telefono?: string; email?: string; persona_contacto?: string; domicilio?: string; observaciones?: string;
};

// El CRUD de proveedor es universal (core): viaja por `bridge().proveedor.*`.
const api = () => bridge() as any;

export function useProveedores() {
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setProveedores(await api().proveedor.list());
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function guardar(payload: ProveedorPayload) {
    await api().proveedor.upsert(payload);
    await load();
  }

  async function desactivar(id: string) {
    await api().proveedor.deactivate(id);
    await load();
  }

  return { proveedores, loading, guardar, desactivar };
}
