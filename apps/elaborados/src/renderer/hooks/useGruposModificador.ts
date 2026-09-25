import { useState, useEffect, useCallback } from 'react';

export type GrupoModificadorRow = { id: string; nombre: string };
export type OpcionModificador = { articulo_id: string; nombre: string; recargo_centavos: number; cantidad: number; orden: number };

export function useGruposModificador() {
  const [grupos, setGrupos] = useState<GrupoModificadorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setGrupos(await (globalThis as any).elaborados.grupoModificador.list());
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function crear(nombre: string) {
    await (globalThis as any).elaborados.grupoModificador.create({ nombre });
    await load();
  }

  async function obtener(id: string): Promise<(GrupoModificadorRow & { opciones: OpcionModificador[] }) | null> {
    return (globalThis as any).elaborados.grupoModificador.get({ id });
  }

  async function setOpciones(grupo_modificador_id: string, opciones: OpcionModificador[]) {
    await (globalThis as any).elaborados.grupoModificador.opcionSet({ grupo_modificador_id, opciones });
  }

  return { grupos, loading, crear, obtener, setOpciones };
}
