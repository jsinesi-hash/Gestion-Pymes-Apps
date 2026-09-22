import { useContext } from 'react';
import { ToastContext } from './ToastProvider';
import type { ToastApi } from './ToastProvider';

/** Feedback central del renderer (ERR-1 / ADR-077). Devuelve `{ success, error, info }`. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
