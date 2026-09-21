import type { KeyboardEvent, HTMLAttributes } from 'react';

/**
 * Props para esparcir sobre un <tr> y hacerlo navegable por clic/teclado.
 * Patrón canónico de ADR-055 (ProveedoresListado). Las acciones por-fila deben
 * frenar la propagación (onClick={e => e.stopPropagation()}) para no navegar.
 */
export function useFilaNavegable(
  onOpen: () => void,
  ariaLabel?: string,
): Pick<HTMLAttributes<HTMLTableRowElement>,
  'tabIndex' | 'role' | 'aria-label' | 'style' | 'onClick' | 'onKeyDown'> {
  return {
    tabIndex: 0,
    role: 'button',
    'aria-label': ariaLabel,
    style: { cursor: 'pointer' },
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    },
  };
}
