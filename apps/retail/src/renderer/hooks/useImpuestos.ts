import { useState, useEffect } from 'react';

export function useImpuestos() {
  const [impuestos, setImpuestos] = useState<any[]>([]);
  useEffect(() => {
    (globalThis as any).ferreteria.catalogo.impuesto.list().then(setImpuestos);
  }, []);
  return impuestos;
}
