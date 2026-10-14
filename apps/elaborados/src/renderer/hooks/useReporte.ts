import { useEffect, useState } from 'react';
import { bridge, traducirError } from '@core/ui';

export type Rango = { desde: string; hasta: string };

export type ResumenVentas = {
  cantidad: number; total_centavos: number; neto_centavos: number; costo_centavos: number; margen_centavos: number;
};
export type VentaDia = ResumenVentas & { dia: string };
export type VentaMedio = { medio_pago: string; monto_centavos: number };
export type ReporteVentasPeriodo = { resumen: ResumenVentas; por_dia: VentaDia[]; por_medio: VentaMedio[] };
export type VentaProducto = { producto_venta_id: string; descripcion: string; unidades: number; importe_centavos: number };
export type VentaSabor = { descripcion: string; veces: number; consumo: number };
export type ReporteVentasProducto = { productos: VentaProducto[]; sabores: VentaSabor[] };
export type FilaStockAlerta = {
  articulo_id: string; nombre: string; unidad: string; stock: number; stock_minimo: number | null;
  estado: 'negativo' | 'bajo_minimo';
};

// El namespace `reporte` es propio de Elaborados: el bridge se tipa como `any`.
const api = () => bridge() as any;

/** Carga un reporte; se vuelve a pedir cuando cambia `clave` y se descartan las respuestas obsoletas. */
function useReporte<T>(clave: string, cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    cargar()
      .then((r) => { if (vigente) setDatos(r); })
      .catch((e) => { if (vigente) { setDatos(null); setError(traducirError(e).mensaje); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    // `cargar` cierra sobre los mismos datos que `clave`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return { datos, cargando, error };
}

export const useReporteVentasPeriodo = (r: Rango) =>
  useReporte<ReporteVentasPeriodo>(`vp:${r.desde}:${r.hasta}`, () => api().reporte.ventasPeriodo(r));

export const useReporteVentasProducto = (r: Rango) =>
  useReporte<ReporteVentasProducto>(`pr:${r.desde}:${r.hasta}`, () => api().reporte.ventasProducto(r));

export const useReporteStockAlertas = () =>
  useReporte<FilaStockAlerta[]>('stock', () => api().reporte.stockAlertas());
