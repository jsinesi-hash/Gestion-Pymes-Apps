import { useState, useEffect } from 'react';

export type ResumenCierre = {
  caja_id: string;
  monto_inicial: number;
  por_forma_pago: Array<{ forma_pago: string; ingresado: number; cantidad_operaciones: number }>;
  esperado_efectivo: number;
  ventas_count: number;
  total_ventas: number;
};

export function useCajaCierre(cajaId: string) {
  const [resumen, setResumen] = useState<ResumenCierre | null>(null);
  const [umbral, setUmbral] = useState(50000);
  const [montoDeclarado, setMontoDeclarado] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (globalThis as any).ferreteria.parametros.get({ clave: 'umbral_diferencia_caja' })
      .then((val: string | null) => { if (val) setUmbral(Number.parseFloat(val)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cajaId) return;
    setIsLoading(true);
    (globalThis as any).ferreteria.caja.calcularCierre({ caja_id: cajaId })
      .then((r: ResumenCierre) => { setResumen(r); setMontoDeclarado(Math.round(r.esperado_efectivo * 100) / 100); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setIsLoading(false));
  }, [cajaId]);

  const diferencia = resumen ? montoDeclarado - resumen.esperado_efectivo : 0;
  const requiereAutorizacion = Math.abs(diferencia) > umbral;

  return { resumen, umbral, montoDeclarado, setMontoDeclarado, diferencia, requiereAutorizacion, isLoading, error };
}
