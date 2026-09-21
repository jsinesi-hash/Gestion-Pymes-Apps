import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketModal } from '../TicketModal';

const mockResult = {
  venta: { id: 'v-1', numero_interno: 'V-C1-000001', total: 1000, forma_pago: 'efectivo', fecha: new Date() },
  detalles: [{ id: 'd-1', descripcion: 'Tornillo M6', cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
  comprobante: { tipo: 'ticket_interno' },
};

describe('TicketModal', () => {
  it('muestra el numero_interno de la venta', () => {
    render(<TicketModal result={mockResult} onNuevaVenta={vi.fn()} canAnular={false} />);
    expect(screen.getByText('V-C1-000001')).toBeInTheDocument();
  });

  it('muestra el total', () => {
    render(<TicketModal result={mockResult} onNuevaVenta={vi.fn()} canAnular={false} />);
    expect(screen.getAllByText(/1\.000/).length).toBeGreaterThan(0);
  });

  it('no muestra botón Anular para Operador (canAnular=false)', () => {
    render(<TicketModal result={mockResult} onNuevaVenta={vi.fn()} canAnular={false} />);
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
  });

  it('muestra botón Anular para Supervisor (canAnular=true)', () => {
    render(<TicketModal result={mockResult} onNuevaVenta={vi.fn()} canAnular={true} />);
    expect(screen.getByRole('button', { name: /anular/i })).toBeInTheDocument();
  });
});
