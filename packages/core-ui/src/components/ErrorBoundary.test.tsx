import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Revisión 2026-10-20 (P1): el renderer no tenía ningún ErrorBoundary: una excepción de render
// (dato IPC inesperado, `.map` sobre undefined) dejaba la ventana de Electron en blanco, en pleno
// POS. Ahora la pantalla que falla se reemplaza por un aviso con "Reintentar".
let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => consoleError.mockRestore());

function Bomba({ falla }: { falla: boolean }) {
  if (falla) throw new Error('boom de render');
  return <div>pantalla sana</div>;
}

describe('ErrorBoundary', () => {
  it('sin errores muestra a sus hijos', () => {
    render(<ErrorBoundary><Bomba falla={false} /></ErrorBoundary>);
    expect(screen.getByText('pantalla sana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si un hijo lanza al renderizar, muestra el aviso y no rompe el resto', () => {
    render(
      <div>
        <p>menú siempre visible</p>
        <ErrorBoundary><Bomba falla /></ErrorBoundary>
      </div>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Algo salió mal/);
    expect(screen.getByText('menú siempre visible')).toBeInTheDocument();
    expect(screen.queryByText('pantalla sana')).toBeNull();
  });

  it('no filtra el mensaje técnico al usuario pero lo registra con el prefijo [ErrorBoundary]', () => {
    render(<ErrorBoundary><Bomba falla /></ErrorBoundary>);
    expect(screen.getByRole('alert')).not.toHaveTextContent('boom de render');
    const registrado = consoleError.mock.calls.some(
      (args) => args[0] === '[ErrorBoundary]' && args[1] instanceof Error && args[1].message === 'boom de render',
    );
    expect(registrado).toBe(true);
  });

  it('avisa al callback onError con el error', () => {
    const onError = vi.fn();
    render(<ErrorBoundary onError={onError}><Bomba falla /></ErrorBoundary>);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe('boom de render');
  });

  it('"Reintentar" vuelve a renderizar los hijos (que ya no fallan)', () => {
    function Harness() {
      const [falla, setFalla] = useState(true);
      return (
        <>
          <button onClick={() => setFalla(false)}>arreglar</button>
          <ErrorBoundary><Bomba falla={falla} /></ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('arreglar'));
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(screen.getByText('pantalla sana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si el hijo sigue fallando, "Reintentar" vuelve a mostrar el aviso', () => {
    render(<ErrorBoundary><Bomba falla /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('se reinicia solo cuando cambia resetKey (p. ej. al navegar a otra pantalla)', () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Bomba falla /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="/b"><Bomba falla={false} /></ErrorBoundary>);
    expect(screen.getByText('pantalla sana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('con la misma resetKey no se reinicia', () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Bomba falla /></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="/a"><Bomba falla={false} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('acepta un fallback propio', () => {
    render(<ErrorBoundary fallback={({ reintentar }) => <button onClick={reintentar}>mi aviso</button>}><Bomba falla /></ErrorBoundary>);
    expect(screen.getByText('mi aviso')).toBeInTheDocument();
  });
});
