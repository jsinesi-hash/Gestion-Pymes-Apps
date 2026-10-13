import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComprobantePayload } from '@ferreteria/shared';
import { TicketModal } from './TicketModal';

const comp: ComprobantePayload = {
  tipo: 'ticket_interno', numero: 'V-C1-000001', fechaIso: '2026-10-13T15:30:00.000Z',
  receptor: { nombre: 'Consumidor Final', condicionFiscal: 'Consumidor Final' },
  items: [{ descripcion: 'Tornillo M6', cantidad: 1, precioUnitarioCentavos: 100000, subtotalCentavos: 100000, alicuotaIva: 21 }],
  ivaPorAlicuota: [{ alicuota: 21, netoCentavos: 82645, ivaCentavos: 17355 }],
  descuentoGlobalCentavos: 0, ajusteRedondeoCentavos: 0, totalCentavos: 100000,
  pagos: [{ medio: 'efectivo', montoCentavos: 100000 }],
};

describe('TicketModal (core)', () => {
  it('muestra número, ítems, total y forma de pago', () => {
    render(<TicketModal comprobante={comp} onNuevaVenta={vi.fn()} />);
    expect(screen.getByText('V-C1-000001')).toBeInTheDocument();
    expect(screen.getByText(/Tornillo M6 × 1/)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
  });

  it('Nueva venta dispara onNuevaVenta', () => {
    const onNueva = vi.fn();
    render(<TicketModal comprobante={comp} onNuevaVenta={onNueva} />);
    fireEvent.click(screen.getByRole('button', { name: /nueva venta/i }));
    expect(onNueva).toHaveBeenCalled();
  });

  it('Imprimir llama a onImprimir con el HTML del ticket; sin onImprimir no hay botón', async () => {
    const onImprimir = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<TicketModal comprobante={comp} onNuevaVenta={vi.fn()} onImprimir={onImprimir} />);
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalledTimes(1));
    expect(onImprimir.mock.calls[0][0]).toContain('TICKET INTERNO');
    unmount();
    render(<TicketModal comprobante={comp} onNuevaVenta={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /imprimir/i })).not.toBeInTheDocument();
  });

  it('el slot de anulación se muestra como botón y, al tener éxito, marca ANULADA', () => {
    render(<TicketModal comprobante={comp} onNuevaVenta={vi.fn()}
      anulacion={({ onSuccess }) => <button onClick={onSuccess}>confirmar-anulacion</button>} />);
    fireEvent.click(screen.getByRole('button', { name: /anular venta/i }));
    fireEvent.click(screen.getByText('confirmar-anulacion'));
    expect(screen.getByText('ANULADA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular venta/i })).not.toBeInTheDocument();
  });

  it('sin slot de anulación no hay botón Anular', () => {
    render(<TicketModal comprobante={comp} onNuevaVenta={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
  });

  it('un comprobante ya anulado muestra ANULADA y no ofrece anular', () => {
    render(<TicketModal comprobante={{ ...comp, anulado: true }} onNuevaVenta={vi.fn()}
      anulacion={() => <div />} />);
    expect(screen.getByText('ANULADA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular venta/i })).not.toBeInTheDocument();
  });
});
