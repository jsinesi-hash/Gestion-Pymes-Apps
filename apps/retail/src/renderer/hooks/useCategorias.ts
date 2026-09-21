import { useState, useEffect } from 'react';

export function useCategorias() {
  const [categorias, setCategorias] = useState<any[]>([]);
  useEffect(() => {
    (globalThis as any).ferreteria.catalogo.categoria.list().then(setCategorias);
  }, []);
  return categorias;
}
