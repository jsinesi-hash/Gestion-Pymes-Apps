import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFilaNavegable } from '../useFilaNavegable';

function Fila({ onOpen }: { onOpen: () => void }) {
  const props = useFilaNavegable(onOpen, 'Ver detalle de X');
  return (
    <table><tbody>
      <tr {...props} data-testid="fila">
        <td>celda</td>
        <td><button onClick={e => { e.stopPropagation(); }}>accion</button></td>
      </tr>
    </tbody></table>
  );
}

describe('useFilaNavegable', () => {
  it('clic en la fila dispara onOpen', () => {
    const onOpen = vi.fn();
    render(<Fila onOpen={onOpen} />);
    fireEvent.click(screen.getByText('celda'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('expone accesibilidad: role=button, tabIndex=0, aria-label', () => {
    render(<Fila onOpen={vi.fn()} />);
    const fila = screen.getByTestId('fila');
    expect(fila).toHaveAttribute('role', 'button');
    expect(fila).toHaveAttribute('tabindex', '0');
    expect(fila).toHaveAttribute('aria-label', 'Ver detalle de X');
  });

  it('Enter y Space navegan; otras teclas no', () => {
    const onOpen = vi.fn();
    render(<Fila onOpen={onOpen} />);
    const fila = screen.getByTestId('fila');
    fireEvent.keyDown(fila, { key: 'Enter' });
    fireEvent.keyDown(fila, { key: ' ' });
    fireEvent.keyDown(fila, { key: 'a' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('una acción con stopPropagation no dispara onOpen', () => {
    const onOpen = vi.fn();
    render(<Fila onOpen={onOpen} />);
    fireEvent.click(screen.getByText('accion'));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
