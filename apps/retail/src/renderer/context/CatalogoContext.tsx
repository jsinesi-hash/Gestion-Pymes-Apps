import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

interface Filtros {
  categoria_id?: string;
  marca_id?: string;
  activo?: boolean;
  stock_status?: 'ok' | 'bajo' | 'sin';
}

type FiltrosUpdate = {
  [K in keyof Filtros]?: Filtros[K] | undefined;
};

// Columnas ordenables del listado de productos (ADR-053). Coinciden con los valores
// aceptados por el IPC `producto.list` (ProductoListParams.sortBy).
export type ProductoSortCol =
  | 'nombre_corto' | 'sku' | 'precio_venta_lista' | 'stock_fisico'
  | 'ubicacion_sector' | 'ubicacion_estante' | 'ubicacion_posicion';

interface CatalogoContextValue {
  busqueda: string;
  setBusqueda: (v: string) => void;
  busquedaUbicacion: string;
  setBusquedaUbicacion: (v: string) => void;
  filtros: Filtros;
  setFiltros: (f: FiltrosUpdate) => void;
  sortBy: ProductoSortCol;
  sortDir: 'asc' | 'desc';
  toggleSort: (col: ProductoSortCol) => void;
  pagina: number;
  setPagina: (p: number) => void;
}

const noop = () => {};

const CatalogoContext = createContext<CatalogoContextValue>({
  busqueda: '',
  setBusqueda: noop,
  busquedaUbicacion: '',
  setBusquedaUbicacion: noop,
  filtros: {},
  setFiltros: noop,
  sortBy: 'nombre_corto',
  sortDir: 'asc',
  toggleSort: noop,
  pagina: 1,
  setPagina: noop,
});

export function CatalogoProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [busqueda, setBusqueda] = useState('');
  const [busquedaUbicacion, setBusquedaUbicacionState] = useState('');
  // ADR-053: por defecto el listado muestra solo productos activos (seguí modificable
  // a "todos"/"inactivos" desde el filtro de estado).
  const [filtros, setFiltrosState] = useState<Filtros>({ activo: true });
  const [sortBy, setSortBy] = useState<ProductoSortCol>('nombre_corto');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pagina, setPagina] = useState(1);

  function setFiltros(update: FiltrosUpdate) {
    setFiltrosState((prev) => {
      const next: Filtros = { ...prev };
      for (const key of Object.keys(update) as (keyof Filtros)[]) {
        const val = update[key];
        if (val === undefined) {
          delete next[key];
        } else {
          (next as any)[key] = val;
        }
      }
      return next;
    });
    setPagina(1);
  }

  function setBusquedaUbicacion(v: string) {
    setBusquedaUbicacionState(v);
    setPagina(1);
  }

  function toggleSort(col: ProductoSortCol) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPagina(1);
  }

  const contextValue = useMemo(
    () => ({
      busqueda, setBusqueda,
      busquedaUbicacion, setBusquedaUbicacion,
      filtros, setFiltros,
      sortBy, sortDir, toggleSort,
      pagina, setPagina,
    }),
    [busqueda, busquedaUbicacion, filtros, sortBy, sortDir, pagina],
  );

  return (
    <CatalogoContext.Provider value={contextValue}>
      {children}
    </CatalogoContext.Provider>
  );
}

export function useCatalogoContext() {
  return useContext(CatalogoContext);
}
