import { useState, useEffect } from 'react';

export function useUbicaciones() {
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);
  useEffect(() => {
    (globalThis as any).ferreteria.catalogo.ubicacion.list().then(setUbicaciones);
  }, []);
  return ubicaciones;
}
