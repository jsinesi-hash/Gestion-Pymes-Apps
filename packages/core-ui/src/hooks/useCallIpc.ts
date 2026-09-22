import { useCallback } from 'react';
import { useToast } from '../components/toast/useToast';
import { traducirError, type ErrorTraducido } from '../lib/errores';

// ERR-1 (ADR-077): envoltorio único para llamadas al IPC. En éxito, toast verde opcional;
// en error, traduce el error (ERR-2) y muestra toast rojo. Devuelve un resultado
// discriminado — NO re-lanza — para que el llamador ramifique por `ok` (p. ej. navegar
// sólo si salió bien). El toast ya avisó del error.

export type ResultadoIpc<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown; traducido: ErrorTraducido };

export type CallIpcOpts = { success?: string };

export type CallIpc = <T>(fn: () => Promise<T>, opts?: CallIpcOpts) => Promise<ResultadoIpc<T>>;

export function useCallIpc(): CallIpc {
  const toast = useToast();
  return useCallback<CallIpc>(async (fn, opts) => {
    try {
      const data = await fn();
      if (opts?.success) toast.success(opts.success);
      return { ok: true, data };
    } catch (error) {
      const traducido = traducirError(error);
      toast.error(traducido.mensaje);
      return { ok: false, error, traducido };
    }
  }, [toast]);
}
