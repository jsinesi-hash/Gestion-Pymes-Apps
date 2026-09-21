import { useCallback, useEffect, useState } from 'react';

export type RemitoListado = {
  id: string;
  numero: string;
  numero_secuencial: number;
  estado: 'emitido' | 'conformado' | 'anulado';
  fecha_emision: number | string | Date;
  fecha_entrega: number | string | Date | null;
  recibido_por: string | null;
  transportista: string | null;
  venta_id: string;
  venta_numero_interno: string | null;
  cliente_nombre_completo: string | null;
};

export type LineaPendiente = {
  venta_detalle_id: string;
  producto_id: string;
  descripcion: string;
  unidad: string | null;
  cantidad_vendida: number;
  cantidad_entregada: number;
  cantidad_pendiente: number;
};

type RemitoApi = {
  crear: (p: unknown) => Promise<{ id: string; numero: string }>;
  listar: (p: unknown) => Promise<RemitoListado[]>;
  obtener: (p: unknown) => Promise<any>;
  pendiente: (p: unknown) => Promise<{ lineas: LineaPendiente[]; domicilio_cliente: string | null }>;
  editar: (p: unknown) => Promise<any>;
  conformar: (p: unknown) => Promise<any>;
  anular: (p: unknown) => Promise<any>;
  imprimir?: (p: unknown) => Promise<any>;
};

export function remitoApi(): RemitoApi {
  return (globalThis as any).ferreteria.remito;
}

/**
 * Feature flag remitos_habilitado (ADR-044). Default false: si el parametro no
 * existe o la lectura falla, el modulo queda oculto.
 */
export function useRemitosHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    let vigente = true;
    (globalThis as any).ferreteria?.parametros
      ?.get({ clave: 'remitos_habilitado' })
      .then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
      .catch(() => { if (vigente) setHabilitado(false); });
    return () => { vigente = false; };
  }, []);

  return habilitado;
}

export function useRemitos(filtros: { estado?: string; venta_id?: string } = {}) {
  const [remitos, setRemitos] = useState<RemitoListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializado para que el efecto no se redispare por identidad del objeto.
  const key = JSON.stringify(filtros);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setRemitos(await remitoApi().listar(JSON.parse(key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [key]);

  useEffect(() => { void recargar(); }, [recargar]);

  return { remitos, cargando, error, recargar };
}
