import { useState, useEffect, useCallback } from 'react';

export function useMarcas() {
  const [marcas, setMarcas] = useState<any[]>([]);
  const load = useCallback(async () => {
    setMarcas(await (globalThis as any).ferreteria.catalogo.marca.list());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createMarca(nombre: string) {
    const m = await (globalThis as any).ferreteria.catalogo.marca.create({ nombre });
    await load();
    return m;
  }

  return { marcas, createMarca };
}
