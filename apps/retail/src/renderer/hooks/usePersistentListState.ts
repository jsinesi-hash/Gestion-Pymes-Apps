import { useCallback, useState } from 'react';

// Persistencia de estado de listados entre navegaciones (ADR-081 / SRCH-3).
// Store a nivel de módulo: sobrevive a desmontar/remontar el listado (ir a un detalle y
// volver) pero se resetea al reiniciar la app — semántica de SESIÓN, idéntica a la que ya
// da `CatalogoContext` para Productos, sin agregar N providers. NO usa localStorage: los
// filtros son estado efímero de trabajo, no preferencia durable (eso es PERF-2).
const store = new Map<string, unknown>();

type Actualizador<T> = T | ((prev: T) => T);

export function usePersistentListState<T>(
  clave: string,
  inicial: T,
): [T, (v: Actualizador<T>) => void] {
  const [estado, setEstado] = useState<T>(() =>
    store.has(clave) ? (store.get(clave) as T) : inicial,
  );

  // Acepta valor directo o updater funcional (como `useState`), para ser un reemplazo
  // drop-in de los `useState` de los listados.
  const set = useCallback(
    (v: Actualizador<T>) => {
      setEstado((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        store.set(clave, next);
        return next;
      });
    },
    [clave],
  );

  return [estado, set];
}

/** Sólo para tests: limpia el store de sesión. */
export function __resetPersistentListState() {
  store.clear();
}
