import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePersistentListState } from '@core/ui';

function Harness({ clave }: { clave: string }) {
  const [texto, setTexto] = usePersistentListState(clave, '');
  return (
    <div>
      <span data-testid="valor">{texto}</span>
      <button onClick={() => setTexto('ana')}>set</button>
    </div>
  );
}

describe('usePersistentListState', () => {
  it('persiste el valor entre desmontar y remontar con la misma clave', () => {
    const { unmount } = render(<Harness clave="clientes-test-1" />);
    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('valor').textContent).toBe('ana');
    unmount();

    render(<Harness clave="clientes-test-1" />);
    expect(screen.getByTestId('valor').textContent).toBe('ana');
  });

  it('no colisiona entre claves distintas', () => {
    render(<Harness clave="clientes-test-2" />);
    fireEvent.click(screen.getByText('set'));

    render(<Harness clave="proveedores-test-2" />);
    // El segundo harness arranca con su inicial, no ve el valor del primero.
    const valores = screen.getAllByTestId('valor').map((n) => n.textContent);
    expect(valores).toContain('');
  });

  it('arranca con el valor inicial cuando la clave nunca se usó', () => {
    render(<Harness clave="virgen-test-3" />);
    expect(screen.getByTestId('valor').textContent).toBe('');
  });
});
