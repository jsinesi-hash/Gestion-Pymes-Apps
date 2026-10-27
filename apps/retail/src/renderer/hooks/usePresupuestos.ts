import { useCallback, useEffect, useState } from 'react';

import { bridge } from '@core/ui';
export type PresupuestoEstado = 'borrador' | 'emitido' | 'vencido' | 'convertido' | 'anulado';

export type PresupuestoListado = {
  id: string;
  numero: string | null;
  numero_secuencial: number | null;
  estado: PresupuestoEstado;
  fecha_emision: number | string | Date | null;
  fecha_validez: number | string | Date | null;
  validez_dias: number;
  total_centavos: number;
  cliente_id: string | null;
  cliente_nombre_completo: string | null;
  venta_id: string | null;
  creado_en: number | string | Date;
};

export type PresupuestoLineaInput = {
  producto_id: string;
  cantidad: number;
  descuento_linea_pct?: number;
  presentacion_id?: string | null;
};

export type ConversionResult = {
  presupuesto_id: string;
  cliente_id: string | null;
  descuento_global_pct: number;
  vencido: boolean;
  aviso: string | null;
  lineas: {
    producto_id: string;
    presentacion_id: string | null;
    descripcion: string;
    cantidad: number;
    descuento_linea_pct: number;
    alicuota_iva: number;
    factor_a_stock: number;
    precio_unitario_centavos: number;
  }[];
};

type PresupuestoApi = {
  crear: (p: unknown) => Promise<any>;
  editar: (p: unknown) => Promise<any>;
  listar: (p: unknown) => Promise<PresupuestoListado[]>;
  obtener: (p: unknown) => Promise<any>;
  anular: (p: unknown) => Promise<any>;
  emitir: (p: unknown) => Promise<any>;
  prepararConversion: (p: unknown) => Promise<ConversionResult>;
  config: () => Promise<{ validez_dias_default: number }>;
  imprimir: (p: unknown) => Promise<{ guardado: boolean; ruta?: string }>;
};

export function presupuestoApi(): PresupuestoApi {
  return bridge().presupuesto;
}

/**
 * Feature flag presupuestos_habilitado (ADR-044/046). Default false: si el parametro
 * no existe o la lectura falla, el modulo queda oculto.
 */
export function usePresupuestosHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    const p = bridge()?.parametros?.get?.({ clave: 'presupuestos_habilitado' });
    if (p && typeof p.then === 'function') {
      p.then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
        .catch(() => { if (vigente) setHabilitado(false); });
    }
    return () => { vigente = false; };
  }, []);
  return habilitado;
}

export function usePresupuestoConfig(): number {
  const [validez, setValidez] = useState(15);
  useEffect(() => {
    let vigente = true;
    presupuestoApi().config()
      .then((c) => { if (vigente) setValidez(c.validez_dias_default); })
      .catch(() => { /* default 15 */ });
    return () => { vigente = false; };
  }, []);
  return validez;
}

export function usePresupuestos(filtros: { estado?: string; cliente_id?: string; incluir_inactivos?: boolean } = {}) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(filtros);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPresupuestos(await presupuestoApi().listar(JSON.parse(key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [key]);

  useEffect(() => { void recargar(); }, [recargar]);

  return { presupuestos, cargando, error, recargar };
}
