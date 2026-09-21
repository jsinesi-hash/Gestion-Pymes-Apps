import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VentaDetalleModal } from '../VentaDetalleModal';

const mockCan = vi.fn().mockReturnValue(false);
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ can: mockCan }),
}));

vi.mock('../../pos/AnulacionModal', () => ({
  AnulacionModal: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="anulacion-modal">
      <button onClick={onSuccess}>confirmar-anulacion</button>
      <button onClick={onCancel}>cancelar-anulacion</button>
    </div>
  ),
}));

const ventaConfirmada = {
  id: 'v-1',
  numero_interno: 'V-C1-000001',
  fecha: new Date('2026-07-14T09:42:00'),
  total: 4850,
  forma_pago: 'efectivo',
  estado: 'confirmada',
  descuento_global: 0,
  ajuste_redondeo: 0,
};

const detallesMock = [
  { id: 'd-1', descripcion: 'Tornillo 6x1"', cantidad: 50, precio_unitario: 25, subtotal: 1250 },
  { id: 'd-2', descripcion: 'Pintura blanca 4L', cantidad: 1, precio_unitario: 3600, subtotal: 3600 },
];

const mockGetOk = vi.fn().mockResolvedValue({
  venta: ventaConfirmada,
  detalles: detallesMock,
  comprobante: { tipo: 'ticket_interno' },
  cliente: { nombre_completo: 'García, Roberto' },
});

const mockPrintHtml = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(false);
  vi.stubGlobal('ferreteria', {
    venta: { get: mockGetOk, anular: vi.fn() },
    catalogo: { print: { html: mockPrintHtml } },
  });
});

describe('VentaDetalleModal', () => {
  it('muestra estado de carga antes de resolver', () => {
    vi.stubGlobal('ferreteria', {
      venta: { get: vi.fn().mockReturnValue(new Promise(() => {})) },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra error si venta.get retorna null', async () => {
    vi.stubGlobal('ferreteria', {
      venta: { get: vi.fn().mockResolvedValue(null) },
      catalogo: { print: { html: vi.fn() } },
    });
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByText(/no encontrada/i));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('muestra numero_interno, cliente, forma_pago, ítems y total', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.getByText('García, Roberto')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Tornillo 6x1"')).toBeInTheDocument();
    expect(screen.getByText('Pintura blanca 4L')).toBeInTheDocument();
    expect(screen.getByText(/4\.850/)).toBeInTheDocument();
  });

  it('muestra badge ANULADA cuando estado es anulada', async () => {
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, estado: 'anulada' },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { nombre_completo: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('ANULADA')).toBeInTheDocument());
  });

  it('no muestra fila descuento_global cuando es 0', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByText(/descuento global/i)).not.toBeInTheDocument();
  });

  it('muestra fila descuento_global cuando es mayor a 0', async () => {
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, descuento_global: 5 },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { nombre_completo: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/descuento global/i)).toBeInTheDocument());
  });

  it('no muestra fila ajuste_redondeo cuando es 0', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByText(/ajuste redondeo/i)).not.toBeInTheDocument();
  });

  it('llama a print.html al hacer click en Reimprimir', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /reimprimir/i }));
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    await waitFor(() => expect(mockPrintHtml).toHaveBeenCalledOnce());
    expect(mockPrintHtml.mock.calls[0][0]).toContain('V-C1-000001');
  });

  it('no muestra botón Cancelar venta si no tiene permiso venta.anular', async () => {
    mockCan.mockReturnValue(false);
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument();
  });

  it('muestra botón Cancelar venta si tiene permiso y venta confirmada', async () => {
    mockCan.mockReturnValue(true);
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument());
  });

  it('no muestra botón Cancelar venta si venta ya está anulada', async () => {
    mockCan.mockReturnValue(true);
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, estado: 'anulada' },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { nombre_completo: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByText('ANULADA'));
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument();
  });

  it('abre AnulacionModal al hacer click en Cancelar venta y en éxito llama onAnulada', async () => {
    mockCan.mockReturnValue(true);
    const onAnulada = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={onAnulada} />);
    await waitFor(() => screen.getByRole('button', { name: /cancelar venta/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar venta/i }));
    expect(screen.getByTestId('anulacion-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirmar-anulacion' }));
    expect(screen.getByText('ANULADA')).toBeInTheDocument();
    expect(onAnulada).toHaveBeenCalled();
  });

  it('llama onClose al hacer click en ✕', async () => {
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('llama onClose al presionar Escape', async () => {
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('NO llama onClose con Escape mientras el AnulacionModal hijo está abierto', async () => {
    mockCan.mockReturnValue(true);
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /cancelar venta/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar venta/i }));
    expect(screen.getByTestId('anulacion-modal')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
