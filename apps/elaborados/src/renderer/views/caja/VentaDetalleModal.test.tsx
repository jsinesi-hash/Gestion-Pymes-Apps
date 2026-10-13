import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VentaDetalleModal } from './VentaDetalleModal';

const mockCan = vi.fn();
vi.mock('@core/ui', async (orig) => ({
  ...(await orig<any>()),
  useAuth: () => ({ can: mockCan }),
  AnulacionModal: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="anulacion-modal">
      <button onClick={onSuccess}>confirmar-anulacion</button>
      <button onClick={onCancel}>cancelar-anulacion</button>
    </div>
  ),
}));

const get = vi.fn();
vi.stubGlobal('elaborados', { venta: { get } });

const DETALLE = {
  venta: { id: 'v1', numero_interno: 'V-C1-000007', fecha: 1700000000000, total: 1500, estado: 'confirmada' },
  lineas: [{
    id: 'l1', descripcion: 'Pote 1/4', cantidad: 1, precio_unitario_centavos: 150000, subtotal_centavos: 150000,
    modificadores: [{ id: 'm1', descripcion: 'Choco' }, { id: 'm2', descripcion: 'DDL' }],
  }],
  cliente: { nombre_completo: 'Ana Pérez' },
};

beforeEach(() => { vi.clearAllMocks(); mockCan.mockReturnValue(false); });

describe('VentaDetalleModal', () => {
  it('carga y muestra número, línea con sabores y total', async () => {
    get.mockResolvedValue(DETALLE);
    render(<VentaDetalleModal ventaId="v1" onClose={vi.fn()} />);
    expect(await screen.findByText(/V-C1-000007/)).toBeInTheDocument();
    expect(screen.getByText(/Pote 1\/4 — Choco, DDL/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toHaveTextContent(/1\.500/);
    expect(get).toHaveBeenCalledWith({ id: 'v1' });
  });

  it('venta inexistente muestra aviso', async () => {
    get.mockResolvedValue(null);
    render(<VentaDetalleModal ventaId="x" onClose={vi.fn()} />);
    expect(await screen.findByText('No se encontró la venta')).toBeInTheDocument();
  });

  it('cerrar llama a onClose', async () => {
    get.mockResolvedValue(DETALLE);
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v1" onClose={onClose} />);
    await screen.findByText(/V-C1-000007/);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('venta confirmada con permiso venta.anular muestra Anular venta', async () => {
    mockCan.mockImplementation((c: string) => c === 'venta.anular');
    get.mockResolvedValue(DETALLE);
    render(<VentaDetalleModal ventaId="v1" onClose={vi.fn()} />);
    await screen.findByText(/V-C1-000007/);
    expect(screen.getByRole('button', { name: 'Anular venta' })).toBeInTheDocument();
  });

  it('sin permiso o con la venta ya anulada no hay botón Anular venta', async () => {
    get.mockResolvedValue(DETALLE);
    const r = render(<VentaDetalleModal ventaId="v1" onClose={vi.fn()} />);
    await screen.findByText(/V-C1-000007/);
    expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
    r.unmount();

    mockCan.mockImplementation((c: string) => c === 'venta.anular');
    get.mockResolvedValue({ ...DETALLE, venta: { ...DETALLE.venta, estado: 'anulada' } });
    render(<VentaDetalleModal ventaId="v1" onClose={vi.fn()} />);
    await screen.findByText('ANULADA');
    expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
  });

  it('tras anular vuelve a pedir venta.get y muestra ANULADA sin cerrarse', async () => {
    mockCan.mockImplementation((c: string) => c === 'venta.anular');
    get.mockResolvedValueOnce(DETALLE)
      .mockResolvedValue({ ...DETALLE, venta: { ...DETALLE.venta, estado: 'anulada' } });
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v1" onClose={onClose} />);
    await screen.findByText(/V-C1-000007/);
    fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
    fireEvent.click(screen.getByText('confirmar-anulacion'));
    expect(await screen.findByText('ANULADA')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
    expect(screen.queryByTestId('anulacion-modal')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
