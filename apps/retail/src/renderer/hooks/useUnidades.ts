import { useState, useEffect } from 'react';

export function useUnidades() {
  const [unidades, setUnidades] = useState<{ id: string; nombre: string; abreviatura: string }[]>([]);
  useEffect(() => {
    (globalThis as any).ferreteria.unidad.list().then(setUnidades).catch(() => {});
  }, []);
  return unidades;
}
