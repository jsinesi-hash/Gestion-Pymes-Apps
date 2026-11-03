import type { KeyboardEvent } from 'react';

/**
 * Props para una fila de tabla clicable (`<tr {...propsFilaActivable(() => abrir(id))}>`).
 *
 * Revisión 2026-10-20 (P2): las filas `<tr onClick>` solo se activaban con el mouse. Acá entran en
 * el orden de tabulación (`tabIndex=0`, con el anillo de foco de `.fila-activable`) y se activan
 * con Enter o Espacio. Una tecla que llega desde un control interno (un botón de la fila) no la
 * activa. No se agrega `role` a la `<tr>`: pisaría la semántica de fila de la tabla.
 */
export function propsFilaActivable(onActivar: () => void) {
  return {
    tabIndex: 0,
    className: 'fila-activable',
    style: { cursor: 'pointer' } as const,
    onClick: onActivar,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivar();
      }
    },
  };
}
