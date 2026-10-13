import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentaDetalleModal } from './VentaDetalleModal';

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

beforeEach(() => { vi.clearAllMocks(); });

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
});
