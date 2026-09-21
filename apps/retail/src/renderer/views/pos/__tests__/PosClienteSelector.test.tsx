import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PosClienteSelector } from '../PosClienteSelector';
import { CONSUMIDOR_FINAL_ID } from '../../../hooks/usePosSession';

const mockCliente = {
  id: 'c-1',
  nombre: 'Ferretería',
  apellido: 'López',
  numero_documento: '30123456',
  tipo_documento: 'CUIT',
  condicion_fiscal: 'Responsable Inscripto',
  habilita_cuenta_corriente: false,
  telefono: '011-4444-5555',
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  (window as any).ferreteria = {
    cliente: {
      list: vi.fn().mockResolvedValue([mockCliente]),
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PosClienteSelector', () => {
  it('renders "Consumidor Final" and "Cambiar" button by default', () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={null}
        onSeleccionar={onSeleccionar}
      />,
    );
    expect(screen.getByText(/consumidor final/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar/i })).toBeInTheDocument();
  });

  it('clicking "Cambiar" shows the search input', async () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={null}
        onSeleccionar={onSeleccionar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });

  it('typing in search calls ferreteria.cliente.list() and shows matching results', async () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={null}
        onSeleccionar={onSeleccionar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    const input = await screen.findByRole('textbox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'López' } });
      await vi.advanceTimersByTimeAsync(200);
    });

    await waitFor(() => {
      expect((window as any).ferreteria.cliente.list).toHaveBeenCalled();
      expect(screen.getByTestId('cliente-dropdown')).toBeInTheDocument();
    });
    expect(screen.getByText(/ferretería lópez/i)).toBeInTheDocument();
  });

  it('selecting a result calls onSeleccionar with full client info', async () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={null}
        onSeleccionar={onSeleccionar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    const input = await screen.findByRole('textbox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'López' } });
      await vi.advanceTimersByTimeAsync(200);
    });

    await waitFor(() => expect(screen.getByTestId('cliente-dropdown')).toBeInTheDocument());

    fireEvent.click(screen.getByText(/ferretería lópez/i));

    expect(onSeleccionar).toHaveBeenCalledWith('c-1', {
      nombre_completo: 'Ferretería López',
      habilita_ccc: false,
      tipo_documento: 'CUIT',
      numero_documento: '30123456',
      condicion_fiscal: 'Responsable Inscripto',
      telefono: '011-4444-5555',
    });
    await waitFor(() => expect(screen.queryByTestId('cliente-dropdown')).not.toBeInTheDocument());
  });

  it('shows client name when client is selected', () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={{
          nombre_completo: 'Ferretería López',
          habilita_ccc: false,
          tipo_documento: 'CUIT',
          numero_documento: '30123456',
          condicion_fiscal: 'Responsable Inscripto',
          telefono: '011-4444-5555',
        }}
        onSeleccionar={onSeleccionar}
      />,
    );
    expect(screen.getByText('Ferretería López')).toBeInTheDocument();
  });

  it('✕ button resets to Consumidor Final', () => {
    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={{
          nombre_completo: 'Ferretería López',
          habilita_ccc: false,
          tipo_documento: 'CUIT',
          numero_documento: '30123456',
          condicion_fiscal: 'Responsable Inscripto',
          telefono: null,
        }}
        onSeleccionar={onSeleccionar}
      />,
    );

    expect(screen.getByText('Ferretería López')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /✕/ }));
    expect(onSeleccionar).toHaveBeenCalledWith(CONSUMIDOR_FINAL_ID, null);
  });

  it('no dropdown shown when query returns no results', async () => {
    (window as any).ferreteria.cliente.list = vi.fn().mockResolvedValue([]);

    const onSeleccionar = vi.fn();
    render(
      <PosClienteSelector
        clienteInfo={null}
        onSeleccionar={onSeleccionar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cambiar/i }));
    const input = await screen.findByRole('textbox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'inexistente' } });
      await vi.advanceTimersByTimeAsync(200);
    });

    await waitFor(() => {
      expect((window as any).ferreteria.cliente.list).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('cliente-dropdown')).not.toBeInTheDocument();
  });
});
