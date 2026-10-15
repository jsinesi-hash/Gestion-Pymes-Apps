import { useCallback, useEffect, useState } from 'react';
import { bridge, traducirError } from '@core/ui';
import type { CatalogoPos } from '../views/pos/tipos';

/** ADR-108: el catálogo se pide por cliente; el main devuelve los precios ya resueltos por su lista. */
export function usePosCatalogo(clienteId?: string) {
  const [catalogo, setCatalogo] = useState<CatalogoPos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const c = (await (bridge() as any).venta.catalogo(clienteId ? { cliente_id: clienteId } : undefined)) as CatalogoPos;
        if (vigente) setCatalogo(c);
      } catch (e) {
        if (vigente) setError(traducirError(e).mensaje);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => { vigente = false; };
  }, [version, clienteId]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { catalogo, cargando, error, recargar };
}
