import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnulacionModal } from './AnulacionModal';
import { configurarBridge } from '../../bridge';

beforeEach(() => {
  vi.clearAllMocks();
  configurarBridge('test');
  vi.stubGlobal('test', { venta: { anular: vi.fn().mockResolvedValue({}) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function avanzarAMotivo(motivo = 'Error de precio') {
  fireEvent.change(screen.getByPlaceholderText(/motivo/i), { target: { value: motivo } });
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('AnulacionModal', () => {
  it('paso inicial: muestra campo motivo y no muestra credenciales de supervisor', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/motivo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña supervisor/i)).not.toBeInTheDocument();
  });

  it('llama onCancel al clickar Cancelar en el paso motivo', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('llama onCancel al presionar Escape en el paso motivo', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('muestra error si motivo está vacío y no avanza de paso', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByText(/el motivo es obligatorio/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/usuario supervisor/i)).not.toBeInTheDocument();
  });

  it('avanza al paso de credenciales cuando el motivo es válido', () => {
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    avanzarAMotivo();
    expect(screen.getByLabelText(/usuario supervisor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña supervisor/i)).toBeInTheDocument();
  });

  it('cancelar en el paso de credenciales vuelve al paso motivo preservando el valor', () => {
    const onCancel = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    avanzarAMotivo('Error de precio');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/motivo/i)).toHaveValue('Error de precio');
  });

  it('llama venta:anular con motivo y credenciales y luego onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<AnulacionModal ventaId="v-1" onSuccess={onSuccess} onCancel={vi.fn()} />);
    avanzarAMotivo('Error de precio');

    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'admin1234' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => expect((globalThis as any).test.venta.anular).toHaveBeenCalledWith({
      venta_id: 'v-1',
      motivo: 'Error de precio',
      supervisor_credenciales: { nombre_usuario: 'admin', password: 'admin1234' },
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('muestra error unificado de supervisor inválido del backend', async () => {
    vi.stubGlobal('test', { venta: { anular: vi.fn().mockRejectedValue(new Error('SUPERVISOR_INVALIDO')) } });
    render(<AnulacionModal ventaId="v-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);
    avanzarAMotivo('Motivo');

    fireEvent.change(screen.getByLabelText(/usuario supervisor/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña supervisor/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() =>
      expect(screen.getByText(/usuario o contraseña incorrectos, o no es supervisor/i)).toBeInTheDocument()
    );
  });
});
