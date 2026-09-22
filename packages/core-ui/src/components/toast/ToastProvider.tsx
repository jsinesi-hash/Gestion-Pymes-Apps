import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ERR-1 (ADR-077): capa de feedback central del renderer. Toast propio, sin dependencias
// (política de CLAUDE.md). Se monta una sola vez, por encima del router (App.tsx), así los
// toasts están disponibles en todas las rutas y sobreviven la navegación.

export type ToastTipo = 'success' | 'error' | 'info';

export type ToastApi = {
  success: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
};

const noop = (): void => {};

// Default no-op: useToast() nunca lanza aunque el componente se renderice sin provider
// (los tests de vistas montan componentes sueltos sin ToastProvider). El provider real
// reemplaza estas funciones.
export const ToastContext = createContext<ToastApi>({ success: noop, error: noop, info: noop });

const DURACION_MS = 4000;

type ToastItem = { id: number; tipo: ToastTipo; mensaje: string };

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const push = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = ++idRef.current;
    setToasts(ts => [...ts, { id, tipo, mensaje }]);
    setTimeout(() => remove(id), DURACION_MS);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
            <span className="toast-msg">{t.mensaje}</span>
            <button type="button" className="toast-close" aria-label="Cerrar" onClick={() => remove(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
