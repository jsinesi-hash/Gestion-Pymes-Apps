import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchBox } from './SearchBox';

// Wrapper controlado que refleja el valor tipeado, como lo haría un listado real.
function Controlado(props: { onDebounced?: (v: string) => void; debounceMs?: number }) {
  const [v, setV] = useState('');
  return (
    <SearchBox
      value={v}
      onChange={setV}
      onDebouncedChange={props.onDebounced}
      debounceMs={props.debounceMs}
      placeholder="Buscar cliente"
    />
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SearchBox', () => {
  it('renderiza el input con su placeholder', () => {
    render(<Controlado />);
    expect(screen.getByPlaceholderText('Buscar cliente')).toBeInTheDocument();
  });

  it('no muestra el botón limpiar cuando está vacío y sí al escribir', () => {
    render(<Controlado />);
    expect(screen.queryByRole('button', { name: /limpiar/i })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente'), { target: { value: 'ana' } });
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });

  it('emite onDebouncedChange sólo después del debounce', () => {
    const onDebounced = vi.fn();
    render(<Controlado onDebounced={onDebounced} debounceMs={250} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente'), { target: { value: 'ana' } });
    expect(onDebounced).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(onDebounced).toHaveBeenCalledWith('ana');
  });

  it('el botón limpiar vacía el valor y dispara el debounced inmediatamente', () => {
    const onDebounced = vi.fn();
    render(<Controlado onDebounced={onDebounced} />);
    const input = screen.getByPlaceholderText('Buscar cliente') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ana' } });
    act(() => { vi.advanceTimersByTime(300); });
    onDebounced.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(input.value).toBe('');
    expect(onDebounced).toHaveBeenCalledWith('');
  });

  it('Escape limpia el valor', () => {
    render(<Controlado />);
    const input = screen.getByPlaceholderText('Buscar cliente') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ana' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });
});
