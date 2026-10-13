import { useEffect, useRef, useState } from 'react';
import { bridge, traducirError } from '@core/ui';
import type { CarritoPayload, Cotizacion } from '../views/pos/tipos';

const DEBOUNCE_MS = 150;

export function usePosCotizacion(payload: CarritoPayload) {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contador = useRef(0);
  const vacio = payload.lineas.length === 0;
  // Clave por CONTENIDO: un consumidor que arme un objeto nuevo en cada render no re-dispara la cotización.
  const clave = JSON.stringify(payload);

  useEffect(() => {
    const miPeticion = ++contador.current;
    if (vacio) {
      setCotizacion(null);
      setCotizando(false);
      setError(null);
      return;
    }
    setCotizando(true);
    const timer = setTimeout(async () => {
      try {
        const r = (await (bridge() as any).venta.cotizar(JSON.parse(clave) as CarritoPayload)) as Cotizacion;
        if (miPeticion !== contador.current) return;
        setCotizacion(r);
        setError(null);
      } catch (e) {
        if (miPeticion !== contador.current) return;
        setCotizacion(null);
        setError(traducirError(e).mensaje);
      } finally {
        if (miPeticion === contador.current) setCotizando(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      // Invalida respuestas en vuelo (cambio de payload o desmontaje).
      contador.current++;
    };
  }, [clave, vacio]);

  return { cotizacion, cotizando, error };
}
