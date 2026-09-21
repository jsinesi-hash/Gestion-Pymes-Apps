import { useEscapeAction } from './useEscapeAction';

/**
 * Cierra un modal/drawer al presionar Escape.
 *
 * `enabled` permite desactivar el cierre por teclado en modales que no deben
 * cerrarse en ciertos momentos (p.ej. mientras hay un submit en curso, igual
 * criterio que ya se usa para deshabilitar el botón de cerrar).
 *
 * Es un envoltorio de {@link useEscapeAction} en la capa `overlay`: así, con dos
 * modales anidados abiertos, un Escape cierra sólo el de más arriba (pila LIFO con
 * un único listener), en vez de que cada modal registre su propio listener y se
 * cierren todos a la vez. Una pantalla completa que use `useEscapeAction` en la capa
 * `page` nunca le gana a un modal abierto.
 */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEscapeAction(onClose, { enabled, layer: 'overlay' });
}
