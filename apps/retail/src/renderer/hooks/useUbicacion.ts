import { useState, useEffect } from 'react';

export function useUbicacion(id: string | undefined) {
  const [ubicacion, setUbicacion] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    (globalThis as any).ferreteria.catalogo.ubicacion.get({ id }).then(setUbicacion);
  }, [id]);
  return ubicacion;
}
