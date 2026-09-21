import { createContext, useContext, type ReactNode } from 'react';
import { usePosSession } from '../hooks/usePosSession';

// ADR-056 Lote 1 — "Venta en curso persistente". El estado del cart (líneas, cliente,
// descuentos, medios en preparación) vive acá, en un provider de renderer montado por
// ENCIMA del router (alrededor de AppShell). Como AppShell no se desmonta al cambiar de
// ruta, el estado sobrevive a la navegación: al volver a /pos el cart aparece idéntico.
//
// IMPORTANTE — alcance: esta persistencia es SOLO de UI (estado del renderer). NO crea
// registros en la BD (ni `venta` borrador, ni movimientos de caja/stock). Eso la
// distingue de la "Venta en espera" (ADR-033), que sí persiste en la BD con estado
// `en_espera`. Ver la sección ADR-056 del ADR-Log.

export type PosSessionValue = ReturnType<typeof usePosSession>;

const PosSessionContext = createContext<PosSessionValue | null>(null);

export function PosSessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const session = usePosSession();
  return <PosSessionContext.Provider value={session}>{children}</PosSessionContext.Provider>;
}

export function usePosSessionContext(): PosSessionValue {
  const ctx = useContext(PosSessionContext);
  if (!ctx) {
    throw new Error('usePosSessionContext debe usarse dentro de <PosSessionProvider>');
  }
  return ctx;
}
