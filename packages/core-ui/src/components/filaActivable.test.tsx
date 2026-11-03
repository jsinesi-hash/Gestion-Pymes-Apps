import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { propsFilaActivable } from './filaActivable';

// Revisión 2026-10-20 (P2): 6 filas `<tr onClick>` solo se podían activar con el mouse. Con
// `propsFilaActivable` entran en el orden de tabulación y se activan con Enter o Espacio.
function Tabla({ onActivar }: { onActivar: () => void }) {
  return (
    <table><tbody>
      <tr data-testid="fila" {...propsFilaActivable(onActivar)}>
        <td>Remito 1</td>
        <td><button type="button">Imprimir</button></td>
      </tr>
    </tbody></table>
  );
}

describe('propsFilaActivable', () => {
  it('la fila entra en el orden de tabulación y se identifica para el estilo de foco', () => {
    render(<Tabla onActivar={() => {}} />);
    const fila = screen.getByTestId('fila');
    expect(fila).toHaveAttribute('tabindex', '0');
    expect(fila).toHaveClass('fila-activable');
    expect(fila).toHaveStyle({ cursor: 'pointer' });
  });

  it('un click activa la fila', () => {
    const fn = vi.fn();
    render(<Tabla onActivar={fn} />);
    fireEvent.click(screen.getByText('Remito 1'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' '])('la tecla %j activa la fila (y no hace scroll ni envía nada)', (tecla) => {
    const fn = vi.fn();
    render(<Tabla onActivar={fn} />);
    const fila = screen.getByTestId('fila');
    const evento = new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true });
    fila.dispatchEvent(evento);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it.each(['a', 'Tab', 'Escape', 'ArrowDown'])('otras teclas (%s) no la activan', (tecla) => {
    const fn = vi.fn();
    render(<Tabla onActivar={fn} />);
    fireEvent.keyDown(screen.getByTestId('fila'), { key: tecla });
    expect(fn).not.toHaveBeenCalled();
  });

  it('Enter sobre un control interno (un botón de la fila) no activa la fila', () => {
    const fn = vi.fn();
    render(<Tabla onActivar={fn} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Imprimir' }), { key: 'Enter' });
    expect(fn).not.toHaveBeenCalled();
  });
});
