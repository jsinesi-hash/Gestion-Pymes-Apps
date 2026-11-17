import { bridge } from '../bridge';
import { useState, useEffect } from 'react';

/** ADR-157: el resumen llega en centavos. */
export type ResumenCierre = {
  caja_id: string;
  monto_inicial_centavos: number;
  por_forma_pago: Array<{ forma_pago: string; ingresado_centavos: number; cantidad_operaciones: number }>;
  esperado_efectivo_centavos: number;
  ventas_count: number;
  total_ventas_centavos: number;
};

export function useCajaCierre(cajaId: string) {
  const [resumen, setResumen] = useState<ResumenCierre | null>(null);
  const [umbralCentavos, setUmbralCentavos] = useState(5_000_000);
  const [montoDeclarado, setMontoDeclarado] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridge().parametros.get({ clave: 'umbral_diferencia_caja_centavos' })
      .then((val: string | null) => { if (val) setUmbralCentavos(Number.parseInt(val, 10)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cajaId) return;
    setIsLoading(true);
    bridge().caja.calcularCierre({ caja_id: cajaId })
      .then((r: ResumenCierre) => { setResumen(r); setMontoDeclarado(r.esperado_efectivo_centavos / 100); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setIsLoading(false));
  }, [cajaId]);

  // El usuario tipea pesos; la comparación se hace en centavos, igual que en el main.
  const diferenciaCentavos = resumen ? Math.round(montoDeclarado * 100) - resumen.esperado_efectivo_centavos : 0;
  const requiereAutorizacion = Math.abs(diferenciaCentavos) > umbralCentavos;
  const diferencia = diferenciaCentavos / 100;
  const umbral = umbralCentavos / 100;

  return { resumen, umbral, montoDeclarado, setMontoDeclarado, diferencia, requiereAutorizacion, isLoading, error };
}
