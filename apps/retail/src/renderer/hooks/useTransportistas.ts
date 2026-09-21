import { useEffect, useState } from 'react';

export type TransportistaOption = { id: string; razon_social: string };

export function useTransportistas() {
  const [transportistas, setTransportistas] = useState<TransportistaOption[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    (globalThis as any).ferreteria.transportista.list({})
      .then((data: TransportistaOption[]) => { if (vigente) setTransportistas(data); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  return { transportistas, cargando };
}
