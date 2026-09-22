import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@core/ui';

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Guardado con éxito')}>ok</button>
      <button onClick={() => toast.error('Algo falló')}>err</button>
      <button onClick={() => toast.info('Un aviso')}>info</button>
    </div>
  );
}

function renderWithProvider() {
  return render(<ToastProvider><Harness /></ToastProvider>);
}

describe('ToastProvider / useToast', () => {
  it('success() muestra un toast con el mensaje', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByText('Guardado con éxito')).toBeInTheDocument();
  });

  it('error() muestra un toast de tipo error (role alert)', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('err'));
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Algo falló');
  });

  it('el toast se puede cerrar manualmente', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText('Guardado con éxito')).toBeNull();
  });

  it('el toast se auto-cierra pasado el timeout', () => {
    vi.useFakeTimers();
    try {
      render(<ToastProvider><Harness /></ToastProvider>);
      fireEvent.click(screen.getByText('info'));
      expect(screen.getByText('Un aviso')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(4500); });
      expect(screen.queryByText('Un aviso')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('permite apilar varios toasts a la vez', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByText('err'));
    expect(screen.getByText('Guardado con éxito')).toBeInTheDocument();
    expect(screen.getByText('Algo falló')).toBeInTheDocument();
  });

  it('useToast() sin provider no lanza (funciones no-op)', () => {
    // Los tests de vistas montan componentes sueltos sin ToastProvider; useToast no debe
    // reventar ahí.
    expect(() => render(<Harness />)).not.toThrow();
    expect(() => fireEvent.click(screen.getByText('ok'))).not.toThrow();
  });
});
